# Módulo 9 · Gestión de alertas

Implementación del 11/11/2026 exclusivamente en frontend, con Angular 22, TypeScript estricto, Bootstrap 5.3 y SCSS. Sin dependencias nuevas.

## Contratos, permisos y estados revisados

Se revisaron `AlertasController`, `GestionAlertasController`, `IniciarRevisionAlertaRequest`, `CerrarAlertaRequest`, el modelo `Alerta`, su configuración RowVersion y la generación de evidencias de `DeteccionAnomaliasService`.

| Operación        | Endpoint existente                        | Contrato                                                                                                                   |
| ---------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Listado          | GET `/api/alertas`                        | `estado`, `reglaAnomaliaId`, `areaId`, `usuarioId`, `fechaDesde`, `fechaHasta`, `pagina`, `tamanoPagina` opcionales.       |
| Detalle          | GET `/api/alertas/{id}`                   | Anomalía, regla, referencias, evidencias JSON, responsables por ID, fechas de revisión/cierre, justificación y RowVersion. |
| Iniciar revisión | POST `/api/alertas/{id}/iniciar-revision` | `{rowVersion}`. Solo desde Pendiente.                                                                                      |
| Cerrar           | POST `/api/alertas/{id}/cerrar`           | `{estado,justificacion,rowVersion}`. Solo desde En revision; destino Resuelta o Descartada.                                |

Los estados transmitidos son `Pendiente`, `En revision`, `Resuelta` y `Descartada`. La interfaz presenta En revisión con tilde y conserva el valor real sin tilde en solicitudes. No hay reapertura, prioridades, asignación libre de responsables, notificaciones, edición genérica ni eliminación.

Auditor tiene alcance global en consultas y cambios, incluidas alertas de seguridad. JefeArea requiere área asignada y activa; accede solo a alertas del área propia que tienen RegistroFinancieroId y cuyo código no es LOGIN_FALLIDO_REITERADO. Esto también excluye los logins fuera de horario sin registro financiero. Administrador o PersonalArea por separado no obtienen acceso. Administrador + JefeArea sí tiene el alcance financiero limitado de JefeArea; Auditor prevalece en cualquier combinación. No se exige que quien cierra sea quien inició la revisión: el controlador permite cerrar a cualquier usuario autorizado sobre esa alerta.

El filtro de área de un JefeArea no amplía su alcance; el servidor filtra primero por autorización y puede devolver una lista vacía para un área ajena. El detalle ajeno o de seguridad restringida devuelve 404. JefeArea con área inactiva recibe 403 en consultas y 404 en mutaciones, según los respectivos controladores. Se mantienen permisos separados `read-alerts`/`manage-alerts`, aunque la condición de roles actualmente coincide.

Las fechas de filtro son inclusivas y corresponden a FechaHoraEvento, no FechaHoraDeteccion. La interfaz las identifica como UTC y reutiliza validaciones de calendario y límites del segundo final. Página mínima 1 y tamaño de 1 a 100; la UI ofrece 10/20/50/100. La API ordena por detección e ID descendentes y devuelve totalRegistros/pagina/tamanoPagina/totalPaginas/alertas. No existe catálogo de reglas: el filtro acepta un ID opcional y los resultados muestran el nombre, código e ID reales.

## Validaciones, confirmaciones y concurrencia

La justificación se envía recortada y exige de 10 a 1000 unidades UTF-16, como string.Length en el backend. RowVersion debe decodificar ocho bytes. El cliente toma la versión del detalle; no es un campo editable. Iniciar revisión y cerrar exigen confirmación explícita. El diálogo de cierre presenta el destino y la justificación exacta que se enviarán, como texto.

Tras un cambio exitoso se muestran los mensajes del servidor y se recargan listado y detalle mediante GET; no se cambia el estado de forma optimista. El detalle puede seguir abierto aunque deje de pertenecer al filtro de estado del listado. Si el cambio elimina la última página del resultado filtrado, se vuelve a una página válida conservando los filtros.

Un 409 puede ser una versión antigua o una transición incompatible. Se cierra la confirmación, se bloquean cambios y se consultan nuevamente lista/detalle. La justificación escrita se conserva si se trata de la misma alerta y sigue en revisión. Un nuevo intento requiere preparar y confirmar otra vez con el estado/versión actuales; no se reenvía automáticamente el POST. Si falla la recarga, los cambios siguen bloqueados hasta obtener un detalle válido. Una pérdida de conexión o respuesta no interpretable también exige consultar el estado actual, porque no acredita un rollback. Los errores de acceso eliminan el detalle protegido.

## Presentación y arquitectura

`features/alerts` separa requests/responses, modelos de presentación/validación, servicio HTTP, página y componentes de filtros, estados, evidencias/detalle y acciones. Reutiliza QueryState para el listado, encabezados, mensajes, paginación, fechas UTC, errores de campo y diálogo de confirmación. El diálogo compartido admite contenido proyectado para presentar la justificación del cierre.

La página conserva filtros y paginación al abrir un detalle inline. Se muestran usuario del evento y referencias de regla/área/registro disponibles, responsables de revisión/cierre por ID (la API no devuelve sus nombres), fechas y justificación. Las evidencias conocidas se presentan con IDs de historial o bitácora; el JSON original completo se conserva como texto, también si es desconocido o no interpretable. No se inserta HTML ni se redondean campos desconocidos al reformatear evidencias.

Los enlaces al registro y a las consultas de historial/bitácora se condicionan a sus permisos propios. En particular, Administrador + JefeArea puede gestionar una alerta financiera sin obtener por ello acceso a trazabilidad. No se inventan rutas de detalle de evidencias que los módulos anteriores no tengan.

La ruta diferida `/alertas`, el menú y el inicio están integrados. El resultado de detección del Módulo 8 enlaza a la gestión de alertas, sin trasladar su contador como si fuera el total pendiente ni ejecutar detecciones al consultar alertas.

## Verificación

`npm.cmd test`: **142 pruebas automatizadas aprobadas en 32 archivos**, suite completa. El HTTP de estas pruebas está **simulado** mediante HttpTestingController. Cubren contratos, filtros, 16 combinaciones de roles, confirmaciones, justificación recortada y límites, evidencias como texto, RowVersion de ocho bytes, doble confirmación, 409 con recarga y nuevo intento explícito, conservación de justificación, bloqueo si falla la recarga, eliminación del detalle tras pérdida de acceso, paginación y retorno a página válida si el filtro pierde su última fila. También verifican que Administrador + JefeArea no obtiene enlaces a trazabilidad y que no se ofrecen acciones de seguridad a JefeArea.

`npm.cmd run build`: **compilación final de producción exitosa**, carga inicial 520,93 kB y alertas como módulo diferido de aproximadamente 27,27 kB. Compilar no acredita integración real.

## Comprobaciones reales de API y SQL

`scripts/validate-module-9.mjs --ui`: **174 comprobaciones aprobadas**, incluyendo preparación y desactivación de datos propios, API y verificaciones SQL de solo lectura. Antes de cada petición/consulta SQL, el script verifica el proceso que escucha en 7202 y exige que sus sesiones SQL estén exclusivamente en `ControlFinancieroDB_Pruebas`. Se volvió a comprobar la conexión antes de las operaciones de navegador. No se inició ni modificó el backend.

Se generaron alertas mediante eventos y detección reales: registros modificados reiteradamente en dos áreas y contraseñas incorrectas de una cuenta QA nueva. No se insertaron alertas ni se cambiaron parámetros de reglas directamente en SQL. El worker permaneció activo. El arnés bloquea mutaciones de IDs de alerta ajenos a su conjunto QA.

Se verificaron listado, detalle/evidencias, filtros de estado/regla/usuario/área/fecha exacta del evento, páginas distintas y resultado vacío. Parámetros inválidos devolvieron 400, falta de JWT 401 y detalle inexistente 404. Las transiciones Pendiente → En revision → Resuelta/Descartada guardaron responsables, fechas, justificación y nueva versión. JefeArea completó un ciclo financiero propio; Auditor gestionó alertas de otra área y de seguridad.

Se rechazaron versiones inválidas, justificaciones vacías, de nueve y de 1001 caracteres, y destinos de cierre no admitidos. Cerrar Pendiente, reiniciar revisión o recerrar una alerta devolvió 409. Cerrar En revision con la versión anterior a su revisión también devolvió 409 y conservó el estado actual.

Se probaron las 15 combinaciones no vacías de roles para listado, detalle y autorización de operaciones. Para verificar mutaciones sin alterar repetidamente fixtures se usaron alertas ya cerradas: el 409 esperado acredita llegada a la validación de estado; **no representa un nuevo cambio exitoso**. Las combinaciones sin Auditor/JefeArea recibieron 403; JefeArea sin Auditor recibió 404 al operar sobre seguridad. Los filtros de área no ampliaron su alcance. Con el área propia inactiva, JefeArea recibió 403 al consultar y 404 al mutar; Auditor conservó acceso global.

La lectura final de bitácora confirmó exactamente seis InicioRevisionAlerta y seis CierreAlerta de los usuarios QA, contando las operaciones de navegador. Los intentos conflictivos no añadieron actividades de éxito duplicadas.

## Navegador, correcciones y limpieza

Se comprobaron listado, filtros, página 2, reinicio al filtrar, estado vacío, detalle, evidencias originales, responsables/fechas, confirmaciones, cancelación, validación de justificación corta y ambos estados finales. Dos vistas cargaron la misma alerta pendiente: la primera inició revisión; la segunda recibió el conflicto con su estado antiguo, cerró su confirmación, cargó los datos actuales y permitió preparar otra acción, sin reenvío automático.

Se detectó un mensaje residual del conflicto anterior dentro de una nueva confirmación de cierre. **Se corrigió en el frontend** limpiando mensajes al preparar una operación válida. Se añadió una regresión simulada y se repitió el caso real sobre otra alerta QA pendiente: el nuevo diálogo mostró únicamente el cierre y su justificación. Ambas alertas se cerraron correctamente. La justificación con `<b>` se presentó literalmente, sin elementos HTML inyectados.

JefeArea consultó sus alertas financieras, sin filtro de otra área ni navegación a detección; filtrar por la regla de contraseñas fallidas produjo vacío. El enlace desde el resultado de detección hacia `/alertas` se verificó mediante una solicitud real y navegación. La revisión móvil a 390 px confirmó documento sin desbordamiento horizontal y tabla con desplazamiento propio.

El simulador de diálogo nativo se adaptó a jsdom y se garantizó limpieza del TestBed ante fallos: es un ajuste del entorno de pruebas, no del diálogo real. El retorno cuando un cambio elimina la última página se validó **con una prueba simulada específica**, sin crear 21 alertas pendientes para forzarlo en vivo.

Ejecución `QA_M9_20261111232036`: áreas 21/22, cuentas 1022/1023/1024 y registros 10042–10045. Las tres cuentas y ambas áreas quedaron desactivadas, confirmado por lectura SQL. El arnés identificó inicialmente las alertas 142–165; el worker generó además alertas QA por logins de la matriz. Todas permanecen trazables por usuarios y registros de origen. Las alertas 151 y 161, utilizadas en navegador, quedaron Descartada y Resuelta. No se borraron datos ni se revisaron/cerraron alertas anteriores a esta ejecución.

Credenciales y JWT solo se procesaron en memoria/entrada oculta, sin guardarlos en código, pruebas, archivos, capturas ni registros. Para repetir: `node scripts/validate-module-9.mjs --ui`, proporcionar las dos credenciales ocultas solicitadas y pulsar Enter tras terminar el navegador. La limpieza utiliza únicamente endpoints sobre cuentas/áreas propias.

## Límites pendientes

No hay exportación de alertas, catálogo de reglas, prioridades, notificaciones, reasignación libre ni reapertura soportadas por la API; no se añadieron. No se hicieron pruebas de carga masiva, pérdida real de red durante una escritura ni una matriz completa de navegadores. Red/respuestas no interpretables y errores de recarga tienen cobertura simulada. La concurrencia se verificó con versiones anteriores en API y vistas antiguas en navegador; no se forzó una carrera interna de SaveChanges entre procesos distintos.

Se ejecutó la suite automatizada completa por los cambios compartidos de políticas, navegación y diálogo. Se revisó la integración con detección por el enlace nuevo, sin repetir la aceptación real de los demás módulos. Siguen vigentes las limitaciones aprobadas anteriores, incluida la precisión del Excel del servidor y el caso del último administrador activo.
