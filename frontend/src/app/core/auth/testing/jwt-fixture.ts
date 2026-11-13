// Synthetic tokens are restricted to tests; they are never sent to a server.
export function testToken(overrides: Record<string, unknown> = {}): string {
  const payload = {
    sub: '7',
    unique_name: 'prueba.admin',
    exp: Math.floor(Date.now() / 1000) + 1800,
    DebeCambiarPassword: 'false',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Administrador',
    ...overrides,
  };
  const body = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.test-signature`;
}
