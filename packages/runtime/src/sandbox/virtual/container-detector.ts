import { accessSync, constants } from 'node:fs';

export type ContainerRuntime = 'docker' | 'podman' | 'nerdctl' | 'none';

export interface ContainerDetection {
  readonly available: boolean;
  readonly runtime: ContainerRuntime;
  readonly socketPath?: string;
}

const DOCKER_SOCKETS = () =>
  [
    '/var/run/docker.sock',
    '/run/docker.sock',
    `${process.env['HOME']}/Library/Containers/com.docker.docker/Data/docker.raw.sock`
  ] as const;

const PODMAN_SOCKETS = () =>
  ['/run/podman/podman.sock', `${process.env['XDG_RUNTIME_DIR'] ?? '/run/user/1000'}/podman/podman.sock`] as const;

function isAccessible(path: string): boolean {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function detectContainerRuntime(): ContainerDetection {
  for (const socketPath of DOCKER_SOCKETS()) {
    if (socketPath && isAccessible(socketPath)) {
      return { available: true, runtime: 'docker', socketPath };
    }
  }

  for (const socketPath of PODMAN_SOCKETS()) {
    if (socketPath && isAccessible(socketPath)) {
      return { available: true, runtime: 'podman', socketPath };
    }
  }

  return { available: false, runtime: 'none' };
}
