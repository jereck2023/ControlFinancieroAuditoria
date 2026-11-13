import { OperationType } from '../../../financial-records/models/requests/record-requests';
export interface PreviewRowResponse {
  numeroFila: number;
  tipoOperacion: OperationType;
  descripcion: string;
  fechaOperacion: string;
  monto: number;
}
export interface ImportErrorResponse {
  numeroFila: number;
  mensaje: string;
}
export interface ImportPreviewResponse {
  totalFilas: number;
  registros: PreviewRowResponse[];
  errores: ImportErrorResponse[];
  esValido: boolean;
  hashArchivo: string;
}
export interface ConfirmImportResponse {
  mensaje: string;
  documentoFinancieroId: number;
  nombreArchivo: string;
  totalImportados: number;
  registrosIds: number[];
}
