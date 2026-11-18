import { describe, it, expect } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';
import {
  optionalId,
  optionalUtcDate,
  utcDateRange,
  utcQueryDate,
  TraceFiltersValue,
} from './trace-query';
import { historyQuery } from '../../features/audit-history/models/requests/history-query';
import { activityQuery } from '../../features/activity-log/models/requests/activity-query';
import { utcTimestamp } from './utc-timestamp';

describe('Trace query dates, IDs and endpoint-specific filters', () => {
  const value: TraceFiltersValue = {
    usuarioId: 8,
    documentoFinancieroId: 4,
    registroFinancieroId: 6,
    tipoAccion: 'Modificacion',
    tipoActividad: ' LoginExitoso ',
    fechaDesde: '2026-11-11T01:02',
    fechaHasta: '2026-11-11T02:03:04',
    tamanoPagina: 50,
  };
  it('uses UTC boundaries and includes the entire upper second', () => {
    expect(utcQueryDate(value.fechaDesde)).toBe('2026-11-11T01:02:00.0000000Z');
    expect(utcQueryDate(value.fechaHasta, true)).toBe('2026-11-11T02:03:04.9999999Z');
    const form = new FormGroup(
      {
        fechaDesde: new FormControl('2026-11-11T02:00'),
        fechaHasta: new FormControl('2026-11-11T01:00'),
      },
      utcDateRange,
    );
    expect(form.hasError('dateRange')).toBe(true);
  });
  it('validates the calendar and optional 32-bit integer IDs', () => {
    expect(optionalId(new FormControl(null))).toBeNull();
    expect(optionalId(new FormControl(2147483647))).toBeNull();
    for (const id of [0, -1, 1.5, 2147483648])
      expect(optionalId(new FormControl(id))).not.toBeNull();
    expect(optionalUtcDate(new FormControl('2024-02-29T12:03:04'))).toBeNull();
    expect(optionalUtcDate(new FormControl('2026-02-29T12:03:04'))).not.toBeNull();
    expect(optionalUtcDate(new FormControl('0000-01-01T00:00'))).not.toBeNull();
  });
  it('never adds unsupported activity, result, area or record filters', () => {
    expect(historyQuery(value)).toEqual({
      pagina: 1,
      tamanoPagina: 50,
      usuarioId: 8,
      documentoFinancieroId: 4,
      registroFinancieroId: 6,
      tipoAccion: 'Modificacion',
      fechaDesde: '2026-11-11T06:02:00.0000000Z',
      fechaHasta: '2026-11-11T07:03:04.9999999Z',
    });
    const query = activityQuery(value);
    expect(query.tipoActividad).toBe('LoginExitoso');
    expect(query).not.toHaveProperty('registroFinancieroId');
    expect(query).not.toHaveProperty('tipoAccion');
    expect(query).not.toHaveProperty('areaId');
    expect(query).not.toHaveProperty('resultado');
  });
  it('does not interpret suffix-free database UTC timestamps as local dates', () => {
    expect(utcTimestamp('2026-11-11T15:25:30')).toBe('11/11/2026 15:25:30');
    expect(utcTimestamp('2026-11-11T15:25:30Z')).toBe('11/11/2026 15:25:30');
    expect(utcTimestamp('2026-11-11T10:25:30-05:00')).toBe('11/11/2026 15:25:30');
  });
});
