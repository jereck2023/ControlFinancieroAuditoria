import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Role } from '../../../core/auth/roles';

export function requiresArea(roles: readonly Role[]): boolean {
  return !(roles.length === 1 && roles[0] === 'Administrador');
}

export function areaForRoles(getRoles: () => readonly Role[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    requiresArea(getRoles()) && control.get('areaId')?.value == null
      ? { areaRequired: true }
      : null;
}
