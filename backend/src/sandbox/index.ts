import path from 'path';
import { existsSync } from 'fs';
import logger from '../logger.js';
import { fileURLToPath } from 'url';
import { PassThrough } from 'stream';
import { getTaskPath } from '../utils/taskPath.js';
import { createDockerClient, resolveDockerSocket } from '../config/docker.js';

const docker = createDockerClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSandboxContextDir(): string {
  // dist/sandbox at runtime — Dockerfile lives in src/sandbox
  const srcDir = path.resolve(__dirname, '../../src/sandbox');
  if (existsSync(path.join(srcDir, 'Dockerfile'))) return srcDir;
  // fallback if Dockerfile was copied next to compiled output
  if (existsSync(path.join(__dirname, 'Dockerfile'))) return __dirname;
  throw new Error(`Sandbox Dockerfile not found (looked in ${srcDir})`);
}

export class SandboxManager {
  private imageBuilt = false;

  async verifyDocker(): Promise<void> {
    const socket = resolveDockerSocket()
    let lastError: unknown
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await docker.ping()
        logger.info('Docker available', { socket: socket ?? 'default' })
        return
      } catch (error) {
        lastError = error
        if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * attempt))
      }
    }
    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    logger.error('Docker ping failed', { socket: socket ?? 'default', detail })
    throw new Error(
      `Docker is not reachable (${detail}). Start Docker Desktop, wait for "Engine running", then retry.`
    )
  }

  async ensureImage() {
    await this.verifyDocker();
    if (this.imageBuilt) return;
    try {
      await docker.getImage('devin-sandbox:latest').inspect();
      this.imageBuilt = true;
      logger.info('Sandbox image already exists');
    } catch {
      logger.info('Building sandbox image...');
      await this.buildImage();
      this.imageBuilt = true;
    }
  }

  async buildImage() {
    const contextDir = getSandboxContextDir();
    const stream = await docker.buildImage(
      { context: contextDir, src: ['Dockerfile'] },
      { t: 'devin-sandbox:latest' }
    );
    await new Promise<void>((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => (err ? reject(err) : resolve()));
    });
    logger.info('Sandbox image built');
  }

  async createContainer(taskId: string) {
    await this.ensureImage();
    const taskPath = getTaskPath(taskId);
    const container = await docker.createContainer({
      Image: 'devin-sandbox:latest',
      Tty: false,
      HostConfig: {
        Memory: 1024 * 1024 * 1024,
        CpuShares: 1024,
        AutoRemove: false,
        Binds: [`${taskPath}:/workspace`],
      },
      Labels: { taskId },
    });

    await container.start();
    logger.info(`Created container: ${taskId} with ID: ${container.id}`);
    return container;
  }

  async exec(containerId: string, command: string, timeoutMs = 30_000) {
    try {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({ hijack: true, stdin: false });
      const stdOutStream = new PassThrough();
      const stdErrStream = new PassThrough();

      docker.modem.demuxStream(stream, stdOutStream, stdErrStream);
      let stdout = '';
      let stderr = '';
      stdOutStream.on('data', (chunk) => { stdout += chunk.toString(); });
      stdErrStream.on('data', (chunk) => { stderr += chunk.toString(); });

      await Promise.race([
        new Promise<void>((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
      ]);

      const inspect = await exec.inspect();
      const exitCode = inspect.ExitCode ?? -1;
      return { stdout, stderr, exitCode };
    } catch (error) {
      logger.error(`Error executing command in container ${containerId}: ${error}`);
      throw error;
    }
  }

  async kill(containerId: string) {
    try {
      await docker.getContainer(containerId).kill();
      logger.info(`Killed container: ${containerId}`);
    } catch {
      // already stopped
    }
  }

  async cleanup(containerId: string) {
    try {
      await docker.getContainer(containerId).remove({ force: true });
      logger.info(`Cleaned up container: ${containerId}`);
    } catch {
      // already removed
    }
  }

  async findOrphans() {
    const containers = await docker.listContainers({ all: true, filters: { label: ['taskId'] } });
    return containers.map((c) => c.Id);
  }

  async cleanupOrphans() {
    const orphans = await this.findOrphans();
    for (const id of orphans) {
      await this.cleanup(id).catch(() => {});
    }
    logger.info(`Cleaned up ${orphans.length} orphan containers`);
  }
}
