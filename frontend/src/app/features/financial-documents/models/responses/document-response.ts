export interface DocumentResponse {
  documentoFinancieroId: number;
  nombreArchivo: string;
  areaId: number;
  nombreArea: string;
  usuarioId: number;
  nombreUsuario: string;
  fechaImportacion: string;
  totalRegistros: number;
}
export interface DocumentDetailResponse extends DocumentResponse {
  hashArchivo: string;
}
