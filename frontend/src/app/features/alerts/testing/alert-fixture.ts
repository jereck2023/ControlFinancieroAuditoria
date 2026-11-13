import { AlertDetailResponse, AlertPageResponse } from '../models/responses/alert-responses';
export function alertFixture(values: Partial<AlertDetailResponse> = {}): AlertDetailResponse {
  return {
    alertaId: 7,
    estado: 'Pendiente',
    titulo: 'Alerta QA',
    descripcion: 'Descripción QA',
    fechaHoraEvento: '2026-11-11T23:00:00',
    fechaHoraDeteccion: '2026-11-11T23:01:00',
    reglaAnomaliaId: 1,
    codigoRegla: 'MODIFICACION_REITERADA',
    nombreRegla: 'Cambios reiterados',
    usuarioId: 2,
    nombreUsuario: 'Usuario QA',
    areaId: 3,
    nombreArea: 'Área QA',
    registroFinancieroId: 8,
    descripcionRegla: 'Regla QA',
    campoModificado: 'Descripcion',
    evidenciasJson: '{"HistorialesAuditoriaId":[1,2,3]}',
    usuarioRevisionId: null,
    fechaInicioRevisionUtc: null,
    usuarioCierreId: null,
    fechaCierreUtc: null,
    justificacionCierre: null,
    rowVersion: 'AAAAAAAAAAE=',
    ...values,
  };
}
export function alertPage(values: Partial<AlertPageResponse> = {}): AlertPageResponse {
  return {
    pagina: 1,
    tamanoPagina: 20,
    totalRegistros: 1,
    totalPaginas: 1,
    alertas: [alertFixture()],
    ...values,
  };
}
