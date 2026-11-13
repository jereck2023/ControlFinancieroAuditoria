import { describe, expect, it } from 'vitest';
import { decodeDetail, decodeSummary } from './report-codec';
import { ReportAmount } from '../components/report-amount';
const page = {
  pagina: 1,
  tamanoPagina: 20,
  totalPaginas: 0,
  filtrosAplicados: { fechaDesde: '2026-11-01', fechaHasta: '2026-11-30' },
};
export function summaryJson(groups = '[]', totalGroups = 0, currentPage = 1): string {
  return `{"cantidadIngresos":2,"totalIngresos":10000000000000000.24,"cantidadEgresos":3,"totalEgresos":10000000000000000.49,"diferencia":-0.25,"agrupacion":"Documento","grupos":${groups},"totalGrupos":${totalGroups},"pagina":${currentPage},"tamanoPagina":20,"totalPaginas":${Math.ceil(totalGroups / 20)},"filtrosAplicados":${JSON.stringify(page.filtrosAplicados)}}`;
}
describe('Report decimals and response contracts', () => {
  it('preserves aggregate amounts above the record limit and negative subunit differences', () => {
    const result = decodeSummary(summaryJson());
    expect(result.totalIngresos).toBe('10000000000000000.24');
    expect(result.totalEgresos).toBe('10000000000000000.49');
    expect(result.diferencia).toBe('-0.25');
    expect(new ReportAmount().transform(result.diferencia)).toBe('-0.25');
    expect(new ReportAmount().transform(result.totalIngresos)).toBe('10,000,000,000,000,000.24');
  });
  it('allows zero totals and null document groups', () => {
    const zero = {
      cantidadIngresos: 0,
      totalIngresos: 0,
      cantidadEgresos: 0,
      totalEgresos: 0,
      diferencia: 0,
    };
    expect(
      decodeSummary(
        JSON.stringify({ ...page, ...zero, agrupacion: 'Ninguna', totalGrupos: 0, grupos: [] }),
      ).diferencia,
    ).toBe('0.00');
    const group = { ...zero, grupoId: null, nombreGrupo: 'Sin documento de origen' };
    expect(decodeSummary(summaryJson(JSON.stringify([group]), 1)).grupos[0].grupoId).toBeNull();
  });
  it('preserves exact individual amounts in detail and rejects malformed responses', () => {
    const row = `{"registroFinancieroId":1,"fechaOperacion":"2026-11-11","tipoOperacion":"Ingreso","descripcion":"QA","monto":9999999999999999.99,"areaId":2,"nombreArea":"QA","usuarioId":3,"nombreUsuario":"QA","documentoFinancieroId":null,"nombreDocumento":"Sin documento de origen"}`;
    expect(
      decodeDetail(
        `{"registros":[${row}],"totalRegistros":1,"pagina":1,"tamanoPagina":20,"totalPaginas":1,"filtrosAplicados":{}}`,
      ).registros[0].monto,
    ).toBe('9999999999999999.99');
    expect(() => decodeSummary('{}')).toThrow('formato');
    expect(() =>
      decodeDetail(JSON.stringify({ ...page, totalRegistros: 1, registros: [{}] })),
    ).toThrow('formato');
  });
});
