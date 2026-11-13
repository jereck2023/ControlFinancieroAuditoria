import { describe, expect, it } from 'vitest';
import { readJwt } from './jwt';

import { testToken } from './testing/jwt-fixture';

describe('JWT presentation claims', () => {
  it('uses the exact server exp instead of a fixed frontend duration', () => {
    const exp = Math.floor(Date.now() / 1000) + 61;
    expect(readJwt(testToken({ exp }))?.expiresAt).toBe(exp * 1000);
  });
  it('expires at the boundary, without clock skew', () => {
    const exp = Math.floor(Date.now() / 1000);
    expect(readJwt(testToken({ exp }), exp * 1000)).toBeNull();
    expect(readJwt(testToken({ exp }), exp * 1000 - 1)).not.toBeNull();
  });
  it('decodes UTF-8 usernames and mandatory password claim', () => {
    expect(readJwt(testToken({ unique_name: 'José', DebeCambiarPassword: 'true' }))).toMatchObject({
      username: 'José',
      mustChangePassword: true,
    });
  });
  it('supports multiple roles without choosing an active role', () => {
    expect(
      readJwt(
        testToken({
          'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': [
            'Administrador',
            'Auditor',
            'Auditor',
          ],
        }),
      )?.roles,
    ).toEqual(['Administrador', 'Auditor']);
  });
  it.each(['invalid', 'a.b.c', '', 'a.b'])('rejects malformed token %s', (token) =>
    expect(readJwt(token)).toBeNull(),
  );
  it('rejects absent exp, invalid identity and absent password claim', () => {
    expect(readJwt(testToken({ exp: undefined }))).toBeNull();
    expect(readJwt(testToken({ sub: 'x' }))).toBeNull();
    expect(readJwt(testToken({ DebeCambiarPassword: undefined }))).toBeNull();
  });
});
