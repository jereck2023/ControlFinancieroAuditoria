export type OperationType = 'Ingreso' | 'Egreso';
/** Wire DTO: decimal is a JSON number, serialized without passing through JS floating point. */
export interface CreateRecordRequest {
  tipoOperacion: OperationType;
  descripcion: string;
  fechaOperacion: string;
  monto: number;
}
export interface UpdateRecordRequest extends CreateRecordRequest {
  rowVersion: string;
}
