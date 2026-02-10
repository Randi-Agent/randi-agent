import Docker from "dockerode";

const DOCKER_SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

const globalForDocker = globalThis as unknown as {
  dockerClient: Docker | undefined;
};

export const docker =
  globalForDocker.dockerClient ?? new Docker({ socketPath: DOCKER_SOCKET });

if (process.env.NODE_ENV !== "production") {
  globalForDocker.dockerClient = docker;
}
