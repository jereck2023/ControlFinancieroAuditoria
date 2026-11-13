import { ReportDetailView, ReportSummaryView } from '../models/report-view';

/** Aggregate amounts may be zero, negative or exceed the individual record limit. */
function decimal(source: string): string {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(source))
    throw new Error('La API devolvió un importe de reporte no válido.');
  const [whole, fraction = ''] = source.split('.');
  const absolute = BigInt(whole.replace('-', '')).toString();
  return `${whole.startsWith('-') ? '-' : ''}${absolute}.${fraction.padEnd(2, '0')}`;
}
function parse(text: string): unknown {
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }) => {
    if (
      !['monto', 'totalIngresos', 'totalEgresos', 'diferencia'].includes(key) ||
      typeof value !== 'number'
    )
      return value;
    if (!context?.source)
      throw new Error('Actualice el navegador para consultar importes sin pérdida de precisión.');
    return decimal(context.source);
  });
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function page(value: Record<string, unknown>): boolean {
  return (
    ['pagina', 'tamanoPagina', 'totalPaginas'].every(
      (key) =>
        typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0,
    ) && object(value['filtrosAplicados'])
  );
}
function totals(value: unknown): boolean {
  return (
    object(value) &&
    ['totalIngresos', 'totalEgresos', 'diferencia'].every(
      (key) => typeof value[key] === 'string' && /^-?\d+\.\d{2}$/.test(value[key]),
    ) &&
    ['cantidadIngresos', 'cantidadEgresos'].every(
      (key) =>
        typeof value[key] === 'number' && Number.isSafeInteger(value[key]) && value[key] >= 0,
    )
  );
}
export function decodeSummary(text: string): ReportSummaryView {
  const value = parse(text);
  if (
    !object(value) ||
    !page(value) ||
    !totals(value) ||
    !['Ninguna', 'Area', 'Documento'].includes(String(value['agrupacion'])) ||
    typeof value['totalGrupos'] !== 'number' ||
    !Array.isArray(value['grupos']) ||
    !value['grupos'].every(
      (g) =>
        object(g) &&
        totals(g) &&
        typeof g['nombreGrupo'] === 'string' &&
        (g['grupoId'] === null || Number.isSafeInteger(g['grupoId'])),
    )
  )
    throw new Error('El resumen financiero no tiene el formato esperado.');
  return value as unknown as ReportSummaryView;
}
export function decodeDetail(text: string): ReportDetailView {
  const value = parse(text);
  if (
    !object(value) ||
    !page(value) ||
    typeof value['totalRegistros'] !== 'number' ||
    !Array.isArray(value['registros']) ||
    !value['registros'].every(
      (r) =>
        object(r) &&
        ['registroFinancieroId', 'areaId', 'usuarioId'].every((key) =>
          Number.isSafeInteger(r[key]),
        ) &&
        [
          'descripcion',
          'fechaOperacion',
          'monto',
          'nombreArea',
          'nombreUsuario',
          'nombreDocumento',
        ].every((key) => typeof r[key] === 'string') &&
        (r['tipoOperacion'] === 'Ingreso' || r['tipoOperacion'] === 'Egreso') &&
        (r['documentoFinancieroId'] === null || Number.isSafeInteger(r['documentoFinancieroId'])),
    )
  )
    throw new Error('El detalle financiero no tiene el formato esperado.');
  return value as unknown as ReportDetailView;
}
