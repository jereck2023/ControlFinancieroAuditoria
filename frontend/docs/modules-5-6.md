# Módulos 5 y 6 · Historial y bitácora

Validación realizada el 11/11/2026. Implementación Angular 22, Bootstrap 5.3 y SCSS, sin dependencias nuevas. No se modificaron backend, migraciones ni base principal.

## Contratos y permisos revisados

Se revisaron los controladores `HistorialAuditoriaController` y `BitacoraActividadesController`, sus DTO de consulta/respuesta, comprobaciones de acceso y origen de las fechas. Se utilizan exclusivamente estas operaciones:

| Recurso                     | Operaciones              | Filtros reales                                                                                                                                               |
| --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/historial-auditoria`  | GET listado, GET `/{id}` | `usuarioId`, `documentoFinancieroId`, `registroFinancieroId`, `tipoAccion` (`Creacion`/`Modificacion`), `fechaDesde`, `fechaHasta`, `pagina`, `tamanoPagina` |
| `/api/bitacora-actividades` | GET listado, GET `/{id}` | `usuarioId`, `documentoFinancieroId`, `tipoActividad` exacto, `fechaDesde`, `fechaHasta`, `pagina`, `tamanoPagina`                                           |

Ambas respuestas paginadas incluyen `pagina`, `tamanoPagina`, `totalRegistros`, `totalPaginas` y `registros`. El servidor permite tamaños de 1 a 100; la interfaz ofrece 10, 20, 50 y 100. No hay filtros por área o resultado, catálogo de tipos de actividad, edición, eliminación ni exportación de estos recursos. No se agregaron capacidades sustitutas.

Auditor tiene alcance global, incluso si su área está inactiva. JefeArea sin Administrador requiere área asignada y activa; el servidor restringe listado y detalle a esa área. Administrador por sí solo y Administrador + JefeArea sin Auditor reciben 403. Si se incluye Auditor, prevalece su alcance global, como ocurre en los controladores. Un detalle de otra área consultado por JefeArea recibe 404. Los filtros no amplían ese alcance.

Menús, inicio y guards comparten `read-traceability`. La condición de área activa y el alcance se comprueban en el servidor; los claims del navegador no sustituyen esa autorización. Las respuestas 401 mantienen el tratamiento compartido de sesión y las 403 muestran la restricción sin conservar resultados anteriores.

## Implementación

- `features/audit-history`: contratos request/response, servicio HTTP, página de consulta y componente de comparación anterior/nuevo. Detalle inline que conserva la página y los filtros aplicados; opción para consultar todos los campos o solo las diferencias y contenido completo en texto.
- `features/activity-log`: contratos request/response, servicio HTTP y página de consulta con detalle de usuario, actividad, resultado, área, documento, IP y descripción. Se manejan referencias y datos nulos sin crear enlaces inválidos.
- `shared/traceability`: filtros reutilizables, validación de identificadores y calendario, construcción de consultas y presentación UTC.
- `shared/http/query-state`: estados de carga, vacío y error, cancelación de peticiones anteriores y limpieza de resultados al consultar de nuevo. Las páginas no mezclan respuestas tardías de filtros o detalles distintos.

Las fechas del servidor se generan en UTC, aunque EF pueda serializarlas sin sufijo. Se presentan explícitamente como UTC. Los filtros también indican UTC y no convierten implícitamente la selección a la zona local. `Hasta` incluye las siete cifras decimales del segundo seleccionado, para evitar perder eventos con precisión de SQL Server. Se rechazan intervalos invertidos antes de consultar.

El JSON de `valoresModificados` se interpreta como datos y se muestra mediante interpolación; no se inserta HTML. Sus importes `Monto` conservan el texto numérico original con `JSON.parse` reviver `context.source`, requisito de navegador moderno ya existente en el módulo 4. Un navegador incompatible muestra un error y no presenta un monto redondeado. Se comparan importes equivalentes sin considerar diferencias de ceros decimales. Para estructuras no comparables se ofrece el contenido recibido como texto.

## Pruebas automatizadas simuladas

`npm.cmd test`: **97 pruebas aprobadas en 22 archivos**, suite completa. Incluye las 16 combinaciones de roles (también ausencia de roles), contratos GET y filtros específicos, paginación, fechas UTC y límites, calendario, importes máximos exactos, contenido HTML tratado como texto, referencias nulas, cancelación de respuestas obsoletas y limpieza al recibir 403.

Los casos HTTP automatizados usan `HttpTestingController`: son respuestas simuladas, no pruebas contra SQL Server ni evidencia de integración real. Se ejecutó la suite completa por los cambios compartidos en permisos y navegación.

`npm.cmd run build`: **compilación de producción exitosa**, carga inicial 520,27 kB y páginas nuevas cargadas de forma diferida. Compilar no sustituye las comprobaciones reales descritas a continuación.

## Comprobaciones reales contra la API

`scripts/validate-modules-5-6.mjs --ui`: **130 comprobaciones aprobadas**, incluyendo preparación y desactivación de datos propios. El script verifica antes de cada petición el proceso que escucha en 7202 y sus sesiones SQL: deben apuntar exclusivamente a `ControlFinancieroDB_Pruebas`. Si la comprobación falla, bloquea la petición. No inicia la API ni cambia su configuración.

Se probaron listados y detalles de ambos recursos, filtros por usuario/documento/registro/acción/tipo según corresponda, intervalos UTC con fechas reales, páginas distintas del servidor, resultados vacíos, parámetros inválidos 400, falta de JWT 401 y detalles inexistentes 404. El detalle histórico comprobó una modificación 10.25 → 20.50 y otra 9999999999999999.98 → 9999999999999999.99.

Se validaron las 15 combinaciones no vacías de los cuatro roles con cuentas propias. Se comprobaron acceso global de Auditor, alcance de JefeArea, detalle ajeno 404, filtros que no amplían permisos y denegación de Administrador + JefeArea sin Auditor. Con el área propia desactivada, JefeArea recibió 403 en ambos recursos y Auditor conservó acceso global. No se alteraron cuentas ni áreas anteriores a esta ejecución.

En navegador contra la API real se verificaron navegación de Auditor, filtros, cambio a página 2 del historial, reinicio de página al filtrar, estados vacíos, detalles de modificación y actividad, precisión de importes máximos, texto con `<b>` sin elementos HTML inyectados, validación del intervalo mediante teclado, presentación móvil a 390 px sin desbordamiento del documento y bloqueo de ambas rutas para el Administrador. Los selectores automatizados de fecha necesitaron entrada de teclado para emitir el evento de entrada; se comprobó el mensaje de intervalo inválido. No se presenta esa limitación de la herramienta como un error del frontend.

Las credenciales temporales y los JWT solo se procesaron en memoria/entrada oculta; no forman parte de scripts, archivos, pruebas, capturas ni registros. Para repetir manualmente: ejecutar `node scripts/validate-modules-5-6.mjs --ui` desde una terminal interactiva, proporcionar las dos credenciales ocultas solicitadas y pulsar Enter tras la revisión de navegador. Cada ejecución crea sus propios datos identificables y los desactiva al terminar.

## Datos y límites

Ejecución `QA_M56_20261111103314`: áreas 16/17, cuentas 1016/1017, registros 10030–10034 y documentos 9/10. Las dos cuentas y las dos áreas fueron desactivadas mediante la API al terminar. Los cinco registros, dos documentos y su trazabilidad permanecen identificados en la base de pruebas: la API no ofrece eliminación y no se borró historial ni bitácora.

No se detectaron errores funcionales pendientes en estos dos módulos durante las comprobaciones ejecutadas. La implementación evita interpretar UTC como hora local, redondear importes históricos o conservar filas después de una respuesta de acceso denegado. No se realizaron pruebas de carga masiva ni una nueva aceptación completa de los módulos anteriores; sus limitaciones previamente documentadas siguen vigentes. La revisión móvil fue de la bitácora y los filtros compartidos; no constituye una matriz completa de navegadores/dispositivos.
