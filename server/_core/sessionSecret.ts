export const MINIMUM_SESSION_SECRET_LENGTH = 32;

export function sessionSecretError(secret: string) {
  if (!secret.trim()) return "JWT_SECRET is required before OAuth sessions can be issued.";
  if (secret.trim().length < MINIMUM_SESSION_SECRET_LENGTH) return `JWT_SECRET must be at least ${MINIMUM_SESSION_SECRET_LENGTH} characters before OAuth sessions can be issued.`;
  return null;
}

export function requireSessionSecret(secret: string) {
  const error = sessionSecretError(secret);
  if (error) throw new Error(error);
  return new TextEncoder().encode(secret);
}
