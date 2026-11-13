import {
  ReportSummaryResponse,
  ReportGroupResponse,
  ReportMovementResponse,
  ReportDetailResponse,
  ReportTotalsResponse,
} from './responses/report-response';
export type ReportTotalsView = Omit<
  ReportTotalsResponse,
  'totalIngresos' | 'totalEgresos' | 'diferencia'
> & { totalIngresos: string; totalEgresos: string; diferencia: string };
export type ReportGroupView = Omit<ReportGroupResponse, keyof ReportTotalsResponse> &
  ReportTotalsView;
export type ReportSummaryView = Omit<ReportSummaryResponse, keyof ReportTotalsResponse | 'grupos'> &
  ReportTotalsView & { grupos: ReportGroupView[] };
export type ReportMovementView = Omit<ReportMovementResponse, 'monto'> & { monto: string };
export type ReportDetailView = Omit<ReportDetailResponse, 'registros'> & {
  registros: ReportMovementView[];
};
export type ReportResult =
  { kind: 'resumen'; data: ReportSummaryView } | { kind: 'detalle'; data: ReportDetailView };
