import { ServerPage } from '../../../../shared/traceability/trace-query';
export interface ActivityRowResponse {
  bitacoraActividadId: number;
  fechaHora: string;
  tipoActividad: string;
  resultado: string;
  usuarioId: number | null;
  nombreUsuario: string;
  areaId: number | null;
  nombreArea: string | null;
  documentoFinancieroId: number | null;
  nombreDocumento: string | null;
  registroFinancieroId: number | null;
}
export interface ActivityDetailResponse extends ActivityRowResponse {
  direccionIp: string | null;
  detalle: string | null;
}
export type ActivityPageResponse = ServerPage<ActivityRowResponse>;
