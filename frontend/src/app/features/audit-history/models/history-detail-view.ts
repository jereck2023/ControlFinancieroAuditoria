import { HistoryDetailResponse, HistoryRowResponse } from './responses/history-responses';
export class ExactAuditNumber {
  constructor(readonly source: string) {}
}
export type DisplayJson =
  | null
  | boolean
  | number
  | string
  | ExactAuditNumber
  | DisplayJson[]
  | { [key: string]: DisplayJson };
export type HistoryDetailView = Omit<HistoryDetailResponse, 'valoresModificados'> & {
  valoresModificados: DisplayJson;
};
export interface ChangeField {
  campo: string;
  etiqueta: string;
  anterior: string;
  nuevo: string;
  modificado: boolean;
}
const labels: Record<string, string> = {
  TipoOperacion: 'Tipo de operación',
  Descripcion: 'Descripción',
  FechaOperacion: 'Fecha de operación',
  Monto: 'Monto',
  AreaId: 'ID de área',
  UsuarioId: 'ID de usuario',
  DocumentoFinancieroId: 'ID de documento',
};

export function displayJson(value: DisplayJson | undefined): string {
  if (value === undefined) return 'No informado';
  if (value === null) return 'Sin valor';
  if (value instanceof ExactAuditNumber) return value.source;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return '[' + value.map((item) => jsonText(item)).join(', ') + ']';
  return (
    '{' +
    Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${jsonText(item)}`)
      .join(', ') +
    '}'
  );
}
function jsonText(value: DisplayJson): string {
  if (value instanceof ExactAuditNumber) {
    const match = value.source.match(/^(-?)(\d+)(?:\.(\d+))?$/);
    if (match) {
      const whole = BigInt(match[2]).toString();
      const fraction = (match[3] ?? '').replace(/0+$/, '');
      return (
        (whole === '0' && !fraction ? '' : match[1]) + whole + (fraction ? '.' + fraction : '')
      );
    }
  }
  return typeof value === 'string' ? JSON.stringify(value) : displayJson(value);
}
function object(value: DisplayJson | undefined): value is { [key: string]: DisplayJson } {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof ExactAuditNumber)
  );
}
export function changeFields(value: DisplayJson): ChangeField[] {
  if (!object(value) || !Object.hasOwn(value, 'Anteriores') || !Object.hasOwn(value, 'Nuevos'))
    return [];
  const before = object(value['Anteriores']) ? value['Anteriores'] : {};
  const after = object(value['Nuevos']) ? value['Nuevos'] : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const readable = (value: DisplayJson | undefined, campo: string): string => {
    if (value !== null && typeof value === 'object' && !(value instanceof ExactAuditNumber))
      return 'Valor no disponible para presentación';
    if (
      campo === 'FechaOperacion' &&
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    )
      return value.split('-').reverse().join('/');
    return displayJson(value);
  };
  return keys
    .filter((campo) => Object.hasOwn(labels, campo))
    .map((campo) => ({
      campo,
      etiqueta: Object.hasOwn(labels, campo) ? labels[campo] : campo,
      anterior: Object.hasOwn(before, campo) ? readable(before[campo], campo) : 'No existía',
      nuevo: Object.hasOwn(after, campo) ? readable(after[campo], campo) : 'No informado',
      modificado:
        !Object.hasOwn(before, campo) ||
        !Object.hasOwn(after, campo) ||
        jsonText(before[campo]) !== jsonText(after[campo]),
    }));
}
function isHistoryRow(value: unknown): value is HistoryRowResponse {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    ['historialAuditoriaId', 'registroFinancieroId', 'areaId', 'usuarioId'].every(
      (key) => typeof item[key] === 'number' && Number.isSafeInteger(item[key]),
    ) &&
    ['nombreDocumento', 'nombreArea', 'nombreUsuario', 'fechaHora', 'tipoAccion'].every(
      (key) => typeof item[key] === 'string',
    ) &&
    (item['documentoFinancieroId'] === null || typeof item['documentoFinancieroId'] === 'number')
  );
}
export function decodeHistoryDetail(text: string): HistoryDetailView {
  const parsed: unknown = JSON.parse(
    text,
    (key: string, value: unknown, context?: { source?: string }) => {
      if (!/^monto$/i.test(key) || typeof value !== 'number') return value;
      if (!context?.source)
        throw new Error(
          'Actualice el navegador para consultar los importes de auditoría sin pérdida de precisión.',
        );
      return new ExactAuditNumber(context.source);
    },
  );
  if (!isHistoryRow(parsed) || !('valoresModificados' in parsed))
    throw new Error('El detalle de auditoría no tiene el formato esperado.');
  // JSON.parse ensures the remaining value is JSON; only amount lexemes are adapted.
  return parsed as HistoryDetailView;
}
