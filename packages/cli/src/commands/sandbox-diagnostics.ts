import { decideSandboxTrigger, detectContainerRuntime } from "@agentsy/runtime";

import type { CliIO } from "../index.js";

interface SandboxDiagnosticsResult {
  containerRuntime: {
    available: boolean;
    runtime: string;
    socketPath?: string;
  };
  defaultTrigger: {
    mode: string;
    reason: string;
  };
  untrustedTrigger: {
    mode: string;
    reason: string;
  };
}

function runDiagnostics(): SandboxDiagnosticsResult {
  const detection = detectContainerRuntime();

  const defaultTrigger = decideSandboxTrigger({
    containerAvailable: detection.available,
  });
  const untrustedTrigger = decideSandboxTrigger({
    containerAvailable: detection.available,
    trustLevel: "untrusted",
  });

  return {
    containerRuntime: {
      available: detection.available,
      runtime: detection.runtime,
      ...(detection.socketPath === undefined
        ? {}
        : { socketPath: detection.socketPath }),
    },
    defaultTrigger: {
      mode: defaultTrigger.mode,
      reason: defaultTrigger.reason,
    },
    untrustedTrigger: {
      mode: untrustedTrigger.mode,
      reason: untrustedTrigger.reason,
    },
  };
}

const defaultIo = {
  stderr: (msg: string) => console.error(msg),
  stdout: (msg: string) => console.log(msg),
};

export function runSandboxDiagnosticsCommand(
  argv: readonly string[],
  io: CliIO = defaultIo
): number {
  const asJson = argv.includes("--json");
  const result = runDiagnostics();

  const stdout = io.stdout ?? defaultIo.stdout;

  if (asJson) {
    stdout(JSON.stringify(result, null, 2));
    return 0;
  }

  stdout("Sandbox Diagnostics");
  stdout("-------------------");
  stdout(`Container runtime:  ${result.containerRuntime.runtime}`);
  stdout(`Container available: ${result.containerRuntime.available}`);
  if (result.containerRuntime.socketPath !== undefined) {
    stdout(`Socket path:        ${result.containerRuntime.socketPath}`);
  }
  stdout("");
  stdout(
    `Default trigger mode:    ${result.defaultTrigger.mode} (${result.defaultTrigger.reason})`
  );
  stdout(
    `Untrusted trigger mode:  ${result.untrustedTrigger.mode} (${result.untrustedTrigger.reason})`
  );
  return 0;
}
