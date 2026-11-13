import { isRole, Role } from './roles';

export interface SessionIdentity {
  readonly userId: number;
  readonly username: string;
  readonly roles: readonly Role[];
  readonly mustChangePassword: boolean;
  readonly expiresAt: number;
}

// Decoding supports the UI only. The API is responsible for signature validation.
export function readJwt(token: string, now = Date.now()): SessionIdentity | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts.every(Boolean)) return null;
    const encoded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')),
      (c) => c.charCodeAt(0),
    );
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object') return null;
    const claims = payload as Record<string, unknown>;
    const exp = claims['exp'];
    const userId = Number(claims['sub']);
    const username = claims['unique_name'];
    if (
      typeof exp !== 'number' ||
      !Number.isFinite(exp) ||
      exp * 1000 <= now ||
      exp * 1000 > 8.64e15 ||
      !Number.isSafeInteger(userId) ||
      userId <= 0 ||
      typeof username !== 'string' ||
      !username.trim()
    )
      return null;
    const claimRoles = claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    const roleValues: unknown[] = Array.isArray(claimRoles) ? claimRoles : [claimRoles];
    const roles = roleValues.filter(isRole);
    const change = claims['DebeCambiarPassword'];
    if (change !== 'true' && change !== 'false') return null;
    return {
      userId,
      username,
      roles: [...new Set(roles)],
      mustChangePassword: change === 'true',
      expiresAt: exp * 1000,
    };
  } catch {
    return null;
  }
}
