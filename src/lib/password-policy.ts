export const MIN_PASSWORD_LENGTH = 6;

export function validatePassword(password: string): string | null {
  const trimmed = password.trim();
  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
