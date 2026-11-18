import { describe, expect, it } from 'vitest';
import { changeFields, decodeHistoryDetail, displayJson } from './history-detail-view';

describe('Historical before/after display', () => {
  const header =
    '"historialAuditoriaId":1,"registroFinancieroId":8,"documentoFinancieroId":null,"nombreDocumento":"Sin documento de origen","areaId":2,"nombreArea":"QA","usuarioId":3,"nombreUsuario":"QA","fechaHora":"2026-11-11T10:00:00","tipoAccion":"Modificacion"';
  it('preserves exact amount digits, compares numeric scale equally and identifies changed fields', () => {
    const detail = decodeHistoryDetail(
      `{${header},"valoresModificados":{"Anteriores":{"Monto":9999999999999999.98,"Descripcion":"Antes","TipoOperacion":"Ingreso"},"Nuevos":{"Monto":9999999999999999.99,"Descripcion":"Después","TipoOperacion":"Ingreso"}}}`,
    );
    const fields = changeFields(detail.valoresModificados);
    expect(fields.find((field) => field.campo === 'Monto')).toMatchObject({
      anterior: '9999999999999999.98',
      nuevo: '9999999999999999.99',
      modificado: true,
    });
    expect(fields.find((field) => field.campo === 'TipoOperacion')?.modificado).toBe(false);
    const scaled = decodeHistoryDetail(
      `{${header},"valoresModificados":{"Anteriores":{"Monto":1.0},"Nuevos":{"Monto":1.00}}}`,
    );
    expect(changeFields(scaled.valoresModificados)[0].modificado).toBe(false);
  });
  it('handles creation without inventing previous values and keeps unknown data readable', () => {
    expect(changeFields({ Anteriores: null, Nuevos: { Descripcion: 'Creado' } })[0]).toMatchObject({
      anterior: 'No existía',
      nuevo: 'Creado',
      modificado: true,
    });
    expect(changeFields({ OtroFormato: ['texto', null] })).toEqual([]);
    expect(displayJson({ OtroFormato: ['texto', null] })).toContain('OtroFormato');
  });
  it('presents known dates and never renders unknown or nested event content', () => {
    const fields = changeFields({
      Anteriores: {
        FechaOperacion: '2026-11-14',
        Descripcion: { interno: 'oculto' },
        Token: 'secreto',
      },
      Nuevos: { FechaOperacion: '2026-11-15', Descripcion: 'Descripción legible', Token: 'otro' },
    });
    expect(fields).toHaveLength(2);
    expect(fields.find((f) => f.campo === 'FechaOperacion')).toMatchObject({
      anterior: '14/11/2026',
      nuevo: '15/11/2026',
    });
    expect(fields.find((f) => f.campo === 'Descripcion')?.anterior).toBe(
      'Valor no disponible para presentación',
    );
    expect(fields.some((f) => f.campo === 'Token')).toBe(false);
  });
});
