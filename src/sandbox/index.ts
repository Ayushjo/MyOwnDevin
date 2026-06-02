import dockerode from 'dockerode';
import path from 'path';
const docker = new dockerode();
import logger from '../logger.js';
import {fileURLToPath} from 'url';
import { PassThrough } from 'stream';
import { stdout } from 'process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class SandboxManager {
  buildImage = async()=>{
    await docker.buildImage({ context: path.join(__dirname, '../../src/sandbox'), src: ['Dockerfile'] },
  { t: 'devin-sandbox:latest' })
  }
  
  async createContainer(taskId: string){
    const container = await docker.createContainer({
  Image: 'devin-sandbox:latest',
  Tty: false,          // false because you want separate stdout/stderr streams
  NetworkDisabled: true, // agent shouldn't have internet access inside sandbox
  HostConfig: {
    Memory: 512 * 1024 * 1024,  // 512MB cap
    CpuShares: 512,              // half CPU weight
    AutoRemove: false,           // you want to manually cleanup after checkpointing
  },
  Labels: {
    taskId: taskId  // so you can find orphaned containers on restart
  }
  
});

  await container.start();
  const info = await container.inspect()
  logger.info(`Contianer status: ${info.State.Status}`)

logger.info(`Created container: ${taskId} with ID: ${container.id}`);
return container
  } // returns containerId
  async exec(containerId: string, command: string){
    try {
      const container = docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: ['sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream =await exec.start({hijack:true,stdin:false})
      const stdOutStream = new PassThrough()
      const stdErrStream = new PassThrough()

      docker.modem.demuxStream(stream,stdOutStream,stdErrStream)
      let stdout = ""
      let stderr = ""
      stdOutStream.on("data",(chunk)=>{stdout+=chunk.toString()})
      stdErrStream.on("data",(chunk)=>{stderr+=chunk.toString()})
      await new Promise<void>((resolve,reject)=>{
        stream.on("end",resolve)
        stream.on("error",reject)
      })
      const inspect = await exec.inspect()
      const exitCode = inspect.ExitCode ?? -1
      logger.info(`stdout: ${stdout}`)
      logger.info(`stderr: ${stderr}`)
      logger.info(`exitCode: ${exitCode}`)
      return {stdout,stderr,exitCode}
      
    } catch (error) {
      logger.error(`Error executing command in container ${containerId}: ${error}`);
    }

  }
  
  async kill(containerId: string){
    await docker.getContainer(containerId).kill();
    logger.info(`Killed container: ${containerId}`);

  }
  async cleanup(containerId: string){
    await docker.getContainer(containerId).remove({ force: true });
    logger.info(`Cleaned up container: ${containerId}`);
  }
  async findOrphans(){
    const containers = await docker.listContainers({ all: true, filters: { label: ['taskId'] } });
    return containers.map(c => c.Id);
  } // returns containerIds
}