import { OperationType } from '../requests/record-requests';
export interface RecordResponse {
  registroFinancieroId: number;
  tipoOperacion: OperationType;
  descripcion: string;
  fechaOperacion: string;
  monto: number;
  areaId: number;
  nombreArea: string;
  usuarioId: number;
  nombreUsuario: string;
  rowVersion: string;
}
export interface CreateRecordResponse {
  mensaje: string;
  registroId: number;
}
// No-change responses omit rowVersion, so the caller must fetch the current record again.
export interface UpdateRecordResponse {
  mensaje: string;
  registroId: number;
  rowVersion?: string;
}
