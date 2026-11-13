export interface PreviewImportRequest {
  archivo: File;
}
export interface ConfirmImportRequest extends PreviewImportRequest {
  hashArchivo: string;
}
