import { FormControl, FormGroup } from '@angular/forms';
import { describe, it, expect } from 'vitest';
import { passwordPolicy, trimmedRequired, matchingPasswords } from './validators';
import { requiresArea, areaForRoles } from '../../features/users/models/user-validation';

describe('Backend-aligned form rules', () => {
  it.each(['shortA1!', 'abcdefghijkl1!', 'ABCDEFGHIJK1!', 'Abcdefghijkl!', 'Abcdefghijk12'])(
    'rejects weak password %s',
    (value) => {
      expect(passwordPolicy(new FormControl(value))).not.toBeNull();
    },
  );
  it('accepts a password matching all configured Identity requirements', () =>
    expect(passwordPolicy(new FormControl('Abcdefghijk1!'))).toBeNull());
  it('rejects whitespace-only names', () =>
    expect(trimmedRequired(new FormControl('   '))).toEqual({ required: true }));
  it('requires matching confirmation', () => {
    const form = new FormGroup(
      { passwordNueva: new FormControl('one'), confirmacion: new FormControl('two') },
      matchingPasswords,
    );
    expect(form.hasError('passwordMismatch')).toBe(true);
  });
  it('allows missing area only for exclusive Administrador', () => {
    expect(requiresArea(['Administrador'])).toBe(false);
    expect(requiresArea(['Auditor'])).toBe(true);
    expect(requiresArea(['Administrador', 'Auditor'])).toBe(true);
    const form = new FormGroup(
      { areaId: new FormControl<number | null>(null) },
      areaForRoles(() => ['Administrador', 'JefeArea']),
    );
    expect(form.hasError('areaRequired')).toBe(true);
    form.controls.areaId.setValue(2);
    expect(form.valid).toBe(true);
  });
});
