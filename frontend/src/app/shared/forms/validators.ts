import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const trimmedRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

export const passwordPolicy: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: unknown = control.value;
  return typeof value === 'string' &&
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^a-zA-Z0-9]/.test(value)
    ? null
    : { passwordPolicy: true };
};

export const matchingPasswords: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  control.get('passwordNueva')?.value === control.get('confirmacion')?.value
    ? null
    : { passwordMismatch: true };
