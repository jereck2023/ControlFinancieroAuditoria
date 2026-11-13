export const ROLES = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  Administrador: 'Administrador',
  PersonalArea: 'Personal de área',
  JefeArea: 'Jefe de área',
  Auditor: 'Auditor',
};
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.some((role) => role === value);
}
