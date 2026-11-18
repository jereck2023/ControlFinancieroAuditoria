import { describe, it, expect } from 'vitest';
import { allows } from './access-policy';
import { Role, ROLES } from './roles';

describe('Administrative permissions', () => {
  const combinations: Role[][] = Array.from({ length: 16 }, (_, mask) =>
    ROLES.filter((_, bit) => (mask & (1 << bit)) !== 0),
  );
  it.each(combinations.map((roles) => ({ roles })))(
    'evaluates the combination $roles without role hierarchy',
    ({ roles }) => {
      expect(allows(roles, 'read-areas')).toBe(
        roles.includes('Administrador') || roles.includes('Auditor'),
      );
      expect(allows(roles, 'read-area-users')).toBe(roles.includes('JefeArea'));
      expect(allows(roles, 'manage-users')).toBe(roles.includes('Administrador'));
      expect(allows(roles, 'manage-areas')).toBe(roles.includes('Administrador'));
      expect(allows(roles, 'read-financial')).toBe(
        roles.some((role) => role === 'PersonalArea' || role === 'JefeArea' || role === 'Auditor'),
      );
      expect(allows(roles, 'write-financial')).toBe(roles.includes('PersonalArea'));
      expect(allows(roles, 'detect-anomalies')).toBe(false);
      for (const permission of ['read-alerts', 'manage-alerts'] as const)
        expect(allows(roles, permission)).toBe(
          roles.includes('Auditor') || roles.includes('JefeArea'),
        );
      expect(allows(roles, 'read-reports')).toBe(
        roles.includes('Auditor') || roles.includes('JefeArea'),
      );
      expect(allows(roles, 'read-traceability')).toBe(
        roles.includes('Auditor') ||
          (roles.includes('JefeArea') && !roles.includes('Administrador')),
      );
    },
  );
});
