import Docker from "dockerode"
import { existsSync } from "fs"
import { homedir } from "os"
import path from "path"

/** Parse DOCKER_HOST when it points at a remote daemon (e.g. Tailscale TCP). */
function dockerFromEnvHost(): Docker | undefined {
  const host = process.env.DOCKER_HOST?.trim()
  if (!host) return undefined

  if (host.startsWith("tcp://") || host.startsWith("http://") || host.startsWith("https://")) {
    const url = new URL(host.replace(/^tcp:\/\//, "http://"))
    const port = url.port ? Number(url.port) : host.startsWith("https://") ? 2376 : 2375
    return new Docker({ host: url.hostname, port })
  }

  return undefined
}

/** Resolve the Docker socket on macOS/Linux (Docker Desktop uses ~/.docker/run/docker.sock). */
export function resolveDockerSocket(): string | undefined {
  if (process.env.DOCKER_HOST?.startsWith("unix://")) {
    return process.env.DOCKER_HOST.slice("unix://".length)
  }

  // Remote TCP/HTTP host takes precedence over local socket discovery.
  if (dockerFromEnvHost()) return undefined

  const candidates = [
    path.join(homedir(), ".docker", "run", "docker.sock"),
    "/var/run/docker.sock",
  ]

  for (const socket of candidates) {
    if (existsSync(socket)) return socket
  }
  return undefined
}

export function createDockerClient(): Docker {
  const remote = dockerFromEnvHost()
  if (remote) return remote

  const socketPath = resolveDockerSocket()
  if (socketPath) {
    return new Docker({ socketPath })
  }
  return new Docker()
}
