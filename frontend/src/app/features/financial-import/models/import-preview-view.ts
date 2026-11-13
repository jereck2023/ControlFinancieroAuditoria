import { ImportPreviewResponse, PreviewRowResponse } from './responses/import-responses';
export type PreviewRowView = Omit<PreviewRowResponse, 'monto'> & { monto: string };
export type ImportPreviewView = Omit<ImportPreviewResponse, 'registros'> & {
  registros: PreviewRowView[];
};

export function validateImportFile(file: File): string | null {
  if (!file.size) return 'El archivo está vacío.';
  if (!/\.xlsx$/i.test(file.name)) return 'Seleccione un archivo .xlsx.';
  if (file.size > 2 * 1024 * 1024) return 'El archivo supera el límite de 2 MB.';
  if (file.name.length > 255) return 'El nombre del archivo supera los 255 caracteres.';
  return null;
}
