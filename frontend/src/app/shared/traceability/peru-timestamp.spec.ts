import { describe, expect, it } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';
import { peruTimestamp } from './peru-timestamp';
import { optionalPeruDate, peruDateRange, peruQueryDate } from './trace-query';
import { historyQuery } from '../../features/audit-history/models/requests/history-query';
import { activityQuery } from '../../features/activity-log/models/requests/activity-query';

describe('Hora de Perú en auditoría y bitácora', () => {
  it.each([
    ['2026-11-15T04:59:59.9999999', '14/11/2026 23:59:59'],
    ['2026-11-15T05:00:00Z', '15/11/2026 00:00:00'],
    ['2026-11-14T23:59:59-05:00', '14/11/2026 23:59:59'],
    ['2026-01-01T04:00:00Z', '31/12/2025 23:00:00'],
    ['inválida', 'Fecha no disponible'],
  ])('presenta %s sin depender de la zona del navegador', (source, expected) => {
    expect(peruTimestamp(source)).toBe(expected);
  });
  it('convierte medianoche a UTC y conserva todos los decimales del segundo final', () => {
    expect(peruQueryDate('2026-11-14T23:59:59', true)).toBe('2026-11-15T04:59:59.9999999Z');
    expect(peruQueryDate('2026-11-15T00:00')).toBe('2026-11-15T05:00:00.0000000Z');
    expect(peruQueryDate('2025-12-31T23:00')).toBe('2026-01-01T04:00:00.0000000Z');
  });
  it('valida calendario, rango del servidor y orden de las horas locales', () => {
    expect(optionalPeruDate(new FormControl('2024-02-29T23:59'))).toBeNull();
    for (const value of ['2026-02-29T12:00', '9999-12-31T23:59', '0000-01-01T00:00'])
      expect(optionalPeruDate(new FormControl(value))).toEqual({ peruDate: true });
    const form = new FormGroup(
      {
        fechaDesde: new FormControl('2026-11-15T00:00'),
        fechaHasta: new FormControl('2026-11-14T23:59:59'),
      },
      peruDateRange,
    );
    expect(form.hasError('dateRange')).toBe(true);
  });
  it('envía los mismos límites convertidos desde ambos módulos', () => {
    const value = {
      usuarioId: null,
      documentoFinancieroId: null,
      registroFinancieroId: null,
      tipoAccion: '' as const,
      tipoActividad: '',
      fechaDesde: '2026-11-14T23:59:59',
      fechaHasta: '2026-11-15T00:00:00',
      tamanoPagina: 10,
    };
    for (const query of [historyQuery(value), activityQuery(value)]) {
      expect(query.fechaDesde).toBe('2026-11-15T04:59:59.0000000Z');
      expect(query.fechaHasta).toBe('2026-11-15T05:00:00.9999999Z');
    }
  });
});
