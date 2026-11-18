import { inject, Injectable } from '@angular/core';
import { Role } from './roles';
import { Session } from './session';

export type Permission =
  | 'read-areas'
  | 'manage-areas'
  | 'manage-users'
  | 'read-area-users'
  | 'read-financial'
  | 'write-financial'
  | 'read-traceability'
  | 'read-reports'
  | 'detect-anomalies'
  | 'read-alerts'
  | 'manage-alerts';

export function allows(roles: readonly Role[], permission: Permission): boolean {
  switch (permission) {
    case 'read-areas':
      return roles.includes('Administrador') || roles.includes('Auditor');
    case 'read-area-users':
      return roles.includes('JefeArea');
    case 'manage-areas':
    case 'manage-users':
      return roles.includes('Administrador');
    case 'read-financial':
      return roles.some(
        (role) => role === 'PersonalArea' || role === 'JefeArea' || role === 'Auditor',
      );
    case 'write-financial':
      return roles.includes('PersonalArea');
    case 'detect-anomalies':
      // The manual interface is temporarily hidden. Backend automation remains independent.
      return false;
    case 'read-reports':
    case 'read-alerts':
    case 'manage-alerts':
      return roles.includes('Auditor') || roles.includes('JefeArea');
    case 'read-traceability':
      return (
        roles.includes('Auditor') ||
        (roles.includes('JefeArea') && !roles.includes('Administrador'))
      );
  }
}

@Injectable({ providedIn: 'root' })
export class AccessPolicy {
  private readonly session = inject(Session);
  can(permission: Permission): boolean {
    const identity = this.session.identity();
    return !!identity && !identity.mustChangePassword && allows(identity.roles, permission);
  }
}
