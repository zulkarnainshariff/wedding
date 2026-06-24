export type SeedUser = {
  username: string;
  password: string;
  isAdmin?: boolean;
  /** Update password and invalidate sessions when user already exists */
  updateIfExists?: boolean;
};

export const SEED_USERS: SeedUser[] = [
  { username: "admin", password: "nafeesa", isAdmin: true },
  { username: "zulkarnain", password: "nafeesa" },
  { username: "natalie", password: "sweetpea", updateIfExists: true },
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
  { username: "christopher", password: "sweetpea" },
  { username: "asmah", password: "elliot", updateIfExists: true },
  { username: "omar", password: "elliot", updateIfExists: true },
  { username: "kamal", password: "elliot", updateIfExists: true },
];
