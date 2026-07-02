import type { UserPermissions } from "../lib/permissions";

export type SeedUser = {
  username: string;
  password: string;
  isAdmin?: boolean;
  roleLevel?: number;
  /** Update password and invalidate sessions when user already exists */
  updateIfExists?: boolean;
  permissions?: Partial<UserPermissions>;
};

export const SEED_USERS: SeedUser[] = [
  {
    username: "root",
    password: "nafeesa",
    roleLevel: 0,
    isAdmin: true,
    updateIfExists: true,
  },
  { username: "admin", password: "nafeesa", isAdmin: true },
  {
    username: "zulkarnain",
    password: "nafeesa",
    permissions: {
      canEdit: true,
    },
  },
  {
    username: "natalie",
    password: "sweetpea",
    updateIfExists: true,
    permissions: {},
  },
  { username: "zulfikar", password: "nafeesa" },
  { username: "nadya", password: "nafeesa" },
  { username: "nadra", password: "nafeesa" },
  { username: "fia", password: "nafeesa" },
  { username: "humaira", password: "nafeesa" },
  { username: "zaiton", password: "nafeesa" },
  { username: "ameerul", password: "nafeesa" },
  { username: "iskandar", password: "nafeesa" },
  { username: "saifullah", password: "nafeesa" },
  { username: "shireen", password: "nafeesa" },
  { username: "umar", password: "nafeesa" },
  { username: "alauddin", password: "nafeesa" },
  { username: "zahirah", password: "nafeesa" },
  { username: "zariya", password: "nafeesa" },
  { username: "stacey", password: "sweetpea" },
  { username: "chris", password: "sweetpea" },
  { username: "asmah", password: "elliot", updateIfExists: true },
  { username: "omar", password: "elliot", updateIfExists: true },
  { username: "kamal", password: "elliot", updateIfExists: true },
];
