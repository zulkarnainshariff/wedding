import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DeployConfig } from "@/lib/deploy-config";

const execFileAsync = promisify(execFile);

async function uploadWithSshpass(
  localPath: string,
  remotePath: string,
  config: DeployConfig,
): Promise<void> {
  const destination = `${config.username}@${config.server}:${remotePath}`;
  await execFileAsync("sshpass", [
    "-p",
    config.password,
    "scp",
    "-o",
    "StrictHostKeyChecking=no",
    localPath,
    destination,
  ]);
}

export async function uploadFileViaScp(
  localPath: string,
  remotePath: string,
  config: DeployConfig,
): Promise<void> {
  try {
    await uploadWithSshpass(localPath, remotePath, config);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("ENOENT")) {
      throw error;
    }
  }

  throw new Error(
    "sshpass is required for SCP upload. Install it (e.g. brew install hudochenkov/sshpass/sshpass) and retry.",
  );
}
