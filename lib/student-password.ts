export type StudentPasswordStatus = {
  required: boolean;
  session_valid: boolean;
  expired: boolean;
  busy: boolean;
  reset_id?: string;
  expires_at?: string;
};

export type TemporaryPasswordResult = {
  ok: boolean;
  message: string;
  temporaryPassword?: string;
  expiresAt?: string;
};

export function parseStudentPasswordStatus(value: unknown): StudentPasswordStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = value as Record<string, unknown>;
  if (["required", "session_valid", "expired", "busy"].some(key => typeof status[key] !== "boolean")) return null;
  if (status.required && (typeof status.reset_id !== "string" || typeof status.expires_at !== "string")) return null;
  return status as StudentPasswordStatus;
}

export function validateNewStudentPassword(current: string, password: string, confirm: string): string | null {
  if (!current || current.length > 128) return "Enter your temporary password.";
  if (password.length < 12 || password.length > 128) return "Choose a password between 12 and 128 characters.";
  if (password !== confirm) return "Passwords don't match.";
  if (password === current) return "Choose a new password different from your temporary password.";
  return null;
}
