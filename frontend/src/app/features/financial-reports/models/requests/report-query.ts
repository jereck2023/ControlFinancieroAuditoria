export type ReportKind = 'resumen' | 'detalle';
export type ReportGrouping = 'Ninguna' | 'Area' | 'Documento';
export interface ReportQuery {
  fechaDesde: string;
  fechaHasta: string;
  tipoOperacion?: 'Ingreso' | 'Egreso';
  areaId?: number;
  documentoFinancieroId?: number;
  soloSinDocumento: boolean;
  agrupacion: ReportGrouping;
  pagina: number;
  tamanoPagina: number;
}
export interface ReportSelection {
  kind: ReportKind;
  query: ReportQuery;
}
