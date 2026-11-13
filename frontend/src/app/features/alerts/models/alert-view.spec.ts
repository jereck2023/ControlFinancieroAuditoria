import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';
import {
  alertEvidence,
  alertStateLabel,
  closeJustification,
  validAlertVersion,
} from './alert-view';
describe('Alert presentation and closure validation', () => {
  it('maps only the real review wire state to its accented label', () => {
    expect(alertStateLabel('En revision')).toBe('En revisión');
    expect(alertStateLabel('Resuelta')).toBe('Resuelta');
  });
  it('validates trimmed justification boundaries with UTF-16 lengths matching the server', () => {
    for (const text of ['', '          ', '123456789', 'a'.repeat(1001)])
      expect(closeJustification(new FormControl(text))).not.toBeNull();
    for (const text of [' 1234567890 ', 'a'.repeat(1000)])
      expect(closeJustification(new FormControl(text))).toBeNull();
  });
  it('reads only known evidence ID shapes and leaves malformed evidence safe for plain text', () => {
    expect(alertEvidence('{"HistorialesAuditoriaId":[1,2],"BitacoraActividadId":3}')).toEqual([
      { name: 'Historial de auditoría', ids: [1, 2] },
      { name: 'Bitácora de actividades', ids: [3] },
    ]);
    expect(alertEvidence('<script>')).toEqual([]);
    expect(alertEvidence('{"BitacorasActividadId":[-1,"2"]}')).toEqual([]);
  });
  it('requires an eight-byte version', () => {
    expect(validAlertVersion('AAAAAAAAAAE=')).toBe(true);
    expect(validAlertVersion('bad')).toBe(false);
    expect(validAlertVersion('')).toBe(false);
  });
});
