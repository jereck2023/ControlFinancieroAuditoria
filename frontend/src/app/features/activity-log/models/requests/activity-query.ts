import {
  TraceQueryBase,
  TraceFiltersValue,
  baseTraceQuery,
} from '../../../../shared/traceability/trace-query';
export interface ActivityQuery extends TraceQueryBase {
  tipoActividad?: string;
}
export function activityQuery(value: TraceFiltersValue): ActivityQuery {
  const tipo = value.tipoActividad.trim();
  return { ...baseTraceQuery(value), ...(tipo ? { tipoActividad: tipo } : {}) };
}
