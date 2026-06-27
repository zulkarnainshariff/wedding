/** 0 = platform operator, 1 = admin, 3 = regular user */
export const ROLE_SUPERUSER = 0;
export const ROLE_ADMIN = 1;
export const ROLE_USER = 3;

export function roleLevelFromDb(
  roleLevel: number | null | undefined,
  isAdmin: boolean,
): number {
  if (typeof roleLevel === "number" && Number.isFinite(roleLevel)) {
    return roleLevel;
  }
  return isAdmin ? ROLE_ADMIN : ROLE_USER;
}

export function isSuperuserRole(roleLevel: number): boolean {
  return roleLevel === ROLE_SUPERUSER;
}

export function isAdminRole(roleLevel: number): boolean {
  return roleLevel === ROLE_ADMIN || roleLevel === ROLE_SUPERUSER;
}

export function isAdminSession(roleLevel: number): boolean {
  return roleLevel <= ROLE_ADMIN;
}
