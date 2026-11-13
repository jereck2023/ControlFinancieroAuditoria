import {
  TraceQueryBase,
  TraceFiltersValue,
  baseTraceQuery,
} from '../../../../shared/traceability/trace-query';
export interface HistoryQuery extends TraceQueryBase {
  registroFinancieroId?: number;
  tipoAccion?: 'Creacion' | 'Modificacion';
}
export function historyQuery(value: TraceFiltersValue): HistoryQuery {
  return {
    ...baseTraceQuery(value),
    ...(value.registroFinancieroId !== null
      ? { registroFinancieroId: value.registroFinancieroId }
      : {}),
    ...(value.tipoAccion ? { tipoAccion: value.tipoAccion } : {}),
  };
}
