import { ReportQuery, ReportGrouping } from '../requests/report-query';
export type AppliedReportFiltersResponse = Omit<
  ReportQuery,
  'tipoOperacion' | 'areaId' | 'documentoFinancieroId'
> & {
  tipoOperacion: 'Ingreso' | 'Egreso' | null;
  areaId: number | null;
  documentoFinancieroId: number | null;
};
export interface ReportTotalsResponse {
  cantidadIngresos: number;
  totalIngresos: number;
  cantidadEgresos: number;
  totalEgresos: number;
  diferencia: number;
}
export interface ReportGroupResponse extends ReportTotalsResponse {
  grupoId: number | null;
  nombreGrupo: string;
}
export interface ReportSummaryResponse extends ReportTotalsResponse {
  agrupacion: ReportGrouping;
  filtrosAplicados: AppliedReportFiltersResponse;
  pagina: number;
  tamanoPagina: number;
  totalGrupos: number;
  totalPaginas: number;
  grupos: ReportGroupResponse[];
}
export interface ReportMovementResponse {
  registroFinancieroId: number;
  fechaOperacion: string;
  tipoOperacion: 'Ingreso' | 'Egreso';
  descripcion: string;
  monto: number;
  areaId: number;
  nombreArea: string;
  usuarioId: number;
  nombreUsuario: string;
  documentoFinancieroId: number | null;
  nombreDocumento: string;
}
export interface ReportDetailResponse {
  totalRegistros: number;
  pagina: number;
  tamanoPagina: number;
  totalPaginas: number;
  filtrosAplicados: AppliedReportFiltersResponse;
  registros: ReportMovementResponse[];
}
