import { RecordView, RecordFormValue } from '../models/record-view';
import { normalizeAmount, parseFinancialJson } from '../models/financial-decimal';

export function isRecord(value: unknown): value is RecordView {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    ['registroFinancieroId', 'areaId', 'usuarioId'].every(
      (key) => typeof r[key] === 'number' && Number.isSafeInteger(r[key]),
    ) &&
    ['descripcion', 'fechaOperacion', 'monto', 'nombreArea', 'nombreUsuario', 'rowVersion'].every(
      (key) => typeof r[key] === 'string',
    ) &&
    (r['tipoOperacion'] === 'Ingreso' || r['tipoOperacion'] === 'Egreso')
  );
}
export function decodeRecord(text: string): RecordView {
  const value = parseFinancialJson(text);
  if (!isRecord(value))
    throw new Error('La respuesta del registro financiero no tiene el formato esperado.');
  return value;
}
export function decodeRecords(text: string): RecordView[] {
  const value = parseFinancialJson(text);
  if (!Array.isArray(value) || !value.every(isRecord))
    throw new Error('El listado financiero no tiene el formato esperado.');
  return value;
}
export function encodeRecord(value: RecordFormValue, rowVersion?: string): string {
  const amount = normalizeAmount(value.monto);
  if (!amount) throw new Error('Ingrese un monto positivo con hasta dos decimales.');
  const other = {
    tipoOperacion: value.tipoOperacion,
    descripcion: value.descripcion.trim(),
    fechaOperacion: value.fechaOperacion,
    ...(rowVersion !== undefined ? { rowVersion } : {}),
  };
  return `${JSON.stringify(other).slice(0, -1)},"monto":${amount}}`;
}
