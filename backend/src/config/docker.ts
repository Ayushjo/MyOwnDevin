import Docker from "dockerode"
import { existsSync } from "fs"
import { homedir } from "os"
import path from "path"

/** Resolve the Docker socket on macOS/Linux (Docker Desktop uses ~/.docker/run/docker.sock). */
export function resolveDockerSocket(): string | undefined {
  if (process.env.DOCKER_HOST?.startsWith("unix://")) {
    return process.env.DOCKER_HOST.slice("unix://".length)
  }

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
  const socketPath = resolveDockerSocket()
  if (socketPath) {
    return new Docker({ socketPath })
  }
  return new Docker()
}
