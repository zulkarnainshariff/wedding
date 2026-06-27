export type DeployConfig = {
  server: string;
  targetDir: string;
  username: string;
  password: string;
};

export function getDeployConfig(): DeployConfig | null {
  const server =
    process.env.DEPLOY_SERVER?.trim() || process.env.SERVER?.trim() || "";
  const targetDir =
    process.env.DEPLOY_TARGET_DIR?.trim() ||
    process.env.DEPLOY_DIRECTORY?.trim() ||
    "";
  const username =
    process.env.DEPLOY_USERNAME?.trim() ||
    process.env.DEPLOY_USER?.trim() ||
    "";
  const password = process.env.DEPLOY_PASSWORD?.trim() || "";

  if (!server || !targetDir || !username || !password) {
    return null;
  }

  return { server, targetDir, username, password };
}

export function describeDeployTarget(config: DeployConfig): string {
  return `${config.username}@${config.server}:${config.targetDir}`;
}
