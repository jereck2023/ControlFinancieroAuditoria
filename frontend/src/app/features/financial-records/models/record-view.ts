import { CreateRecordRequest } from './requests/record-requests';
import { RecordResponse } from './responses/record-response';
/** Presentation models preserve all decimal digits independently of the JSON numeric wire type. */
export type RecordView = Omit<RecordResponse, 'monto'> & { monto: string };
export type RecordFormValue = Omit<CreateRecordRequest, 'monto'> & { monto: string };
