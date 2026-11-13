# Módulo 8 · Detección mediante reglas predefinidas

Actualización posterior: la gestión descrita como pendiente en esta entrega se implementó en el Módulo 9 (`module-9.md`). El resultado de detección ya enlaza a esa sección; se conservan aquí los resultados y límites de la validación original de detección.

Implementación del 11/11/2026, exclusivamente en frontend. Angular 22, Bootstrap 5.3, SCSS y TypeScript estricto; sin nuevas dependencias.

## Contrato y alcance reales

Se revisaron `AnomaliasController`, `DeteccionAnomaliasService`, `DeteccionAnomaliasWorker`, el modelo `ReglaAnomalia`, la configuración de reglas y los registros de acceso de `AuthController`. Los controladores de consulta/gestión de alertas se revisaron para delimitar el Módulo 9; no se integraron sus endpoints en esta pantalla.

Solo existe `POST /api/anomalias/detectar`, sin DTO de entrada, cuerpo, selección de reglas, filtros o paginación. La respuesta es `{mensaje: string, nuevasAlertas: number}`. Se separan el contrato de solicitud sin cuerpo (`null`) y el contrato de respuesta. La respuesta se valida antes de presentarla; no contiene IDs, listado de alertas ni desglose por regla.

La autorización exige **Auditor**, solo o combinado con cualquiera de los otros roles. Administrador, JefeArea y PersonalArea sin Auditor reciben 403. El alcance de ejecución es global, sin filtro por área. El permiso `detect-anomalies` se aplica en ruta, menú, inicio y acción; el servidor sigue siendo la autoridad de autorización.

No hay endpoints de catálogo de reglas o lectura de sus parámetros vigentes, ni de creación, edición, activación/desactivación o eliminación de reglas. Por ello se ofrece una referencia explicativa de la lógica revisada, claramente diferenciada de configuración actual. No se presentan los valores iniciales de las migraciones como parámetros vigentes ni se simulan llamadas de consulta.

## Reglas revisadas

| Código                  | Situaciones y condiciones implementadas                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MODIFICACION_REITERADA  | Historial de Modificacion, agrupado por usuario, registro y campo; compara los valores JSON anteriores/nuevos de TipoOperacion, Descripcion, FechaOperacion y Monto. Requiere umbral y ventana en minutos positivos.                                                           |
| FUERA_DE_HORARIO        | Modificaciones financieras e inicios de sesión exitosos de usuarios identificados, fuera de los días y horas configurados, usando zona de Perú. Inicio inclusivo y fin exclusivo. No evalúa toda actividad genérica ni altas de registros.                                     |
| LOGIN_FALLIDO_REITERADO | Bitácora LoginFallido, resultado Fallido, UsuarioId identificado y detalle exacto Contraseña incorrecta.; agrupa por cuenta y ventana. No cuenta usuarios inexistentes, usuarios inactivos ni intentos de acceso a cuentas ya bloqueadas. Requiere umbral y ventana positivos. |

El servicio toma reglas activas de SQL Server, mantiene FechaUltimaEvaluacionUtc y utiliza una mirada inicial de 24 horas si ese dato es nulo, ampliada por ventanas configuradas. Manual y worker comparten exclusión de ejecución dentro del proceso. El worker revisa cada minuto. La deduplicación usa ClaveDeteccion por regla, tipo de evento e ID disparador; el contador representa solo alertas nuevas guardadas por esa llamada.

No se utiliza inteligencia artificial ni aprendizaje automático. La detección puede crear alertas Pendiente y avanzar el seguimiento de evaluación de las reglas. Su lectura detallada, asignación, revisión, cierre y cambios de estado quedan fuera de este módulo.

## Frontend y comportamiento

`features/anomaly-detection` separa contracts request/response, servicio HTTP, página y componentes `RuleReference`/`DetectionResult`. Se reutilizan encabezados, mensajes y políticas compartidas. Ruta diferida `/deteccion-anomalias`; no hay enlaces ficticios a alertas ni controles de mantenimiento de reglas.

No se ejecuta al abrir, recargar o navegar; requiere acción explícita. El botón y la comprobación de estado evitan envíos duplicados mientras hay una solicitud en curso. Una nueva ejecución limpia el resultado anterior; los mensajes del servidor se muestran por interpolación segura. Cero alertas nuevas no se interpreta como ausencia de anomalías o alertas previas.

No se reintenta automáticamente un POST. Ante fallo de conexión, error de servidor o respuesta no interpretable se indica que el resultado no pudo confirmarse: no se asegura un rollback. Los 401/403 conservan el manejo compartido de sesión y autorización. No se persisten datos del resultado, credenciales ni JWT adicionales.

## Verificación

`npm.cmd test`: **126 pruebas automatizadas aprobadas en 28 archivos**. Cubren las 16 combinaciones de roles, POST sin cuerpo/parámetros, validación del contrato, cero y valores positivos, ausencia de consultas/ejecución al entrar, doble clic, permiso específico, texto HTML tratado como texto, eliminación de éxito anterior tras 403 y error de red sin reintento ni falsa promesa de rollback. El HTTP de estas pruebas es simulado mediante HttpTestingController.

`npm.cmd run build`: compilación final de producción exitosa, carga inicial 520,74 kB y módulo diferido de aproximadamente 7,22 kB. Compilar no acredita el funcionamiento contra la API.

## Integración real

`scripts/validate-module-8.mjs --ui` finalizó con **37 comprobaciones reales aprobadas de API/SQL**, incluyendo preparación y desactivación de datos propios. Antes de cada petición y consulta SQL comprueba las sesiones SQL del proceso que escucha en 7202; exige conexión exclusivamente a `ControlFinancieroDB_Pruebas`. Los accesos SQL del arnés son de solo lectura. Las escrituras se hicieron mediante endpoints existentes.

La lectura previa confirmó las tres reglas activas y, en esta base de pruebas, umbral de cambios 3 en 30 minutos y contraseñas incorrectas 5 en 15 minutos; horario 08:00 incluido a 18:00 excluido, de lunes a viernes, zona Perú. Estos valores describen la configuración observada durante la prueba, no se codifican como configuración vigente de la interfaz ni se alteraron para provocar resultados.

Con un registro y dos cuentas QA nuevos se realizaron tres modificaciones consecutivas de Descripcion y cinco contraseñas incorrectas de una cuenta QA identificada. La primera detección manual devolvió **nuevasAlertas: 2**. La consulta de verificación confirmó una alerta MODIFICACION_REITERADA para ese registro/campo y una LOGIN_FALLIDO_REITERADO para esa cuenta. Las ocho combinaciones de roles que contienen Auditor recibieron 200; las siete restantes recibieron 403. Sin JWT se obtuvo 401. Las evaluaciones posteriores devolvieron cero y no duplicaron las dos alertas QA. Se confirmó el avance de FechaUltimaEvaluacionUtc de las reglas activas.

En navegador se verificaron acceso y navegación de Auditor, ejecución explícita, mensaje real, resultado cero con explicación de su alcance, resultado positivo y denegación de la ruta al Administrador exclusivo. La revisión a 390 px mostró tres referencias de reglas y documento sin desbordamiento horizontal. El servidor alcanzó naturalmente el horario de cierre durante la revisión: un nuevo login QA a las **18:00:48 de Perú** produjo una detección manual con **nuevasAlertas: 1**. Se confirmó por lectura la alerta FUERA_DE_HORARIO titulada Inicio de sesión fuera de horario, con evento 23:00:48 UTC. No se cambió el reloj, el horario, la activación ni los parámetros de reglas.

El worker automático permaneció activo durante estas pruebas. El arnés comprueba alertas de origen conocido y deduplicación, sin atribuir arbitrariamente al POST lo que pudiera procesar el worker. Los contadores de las llamadas y los eventos QA permiten distinguir ambos conceptos. No se hicieron consultas ni cambios de estados con los endpoints del Módulo 9.

Se corrigió una incompatibilidad de opciones de sqlcmd en el arnés antes de crear datos; aquel primer intento no ejecutó detecciones ni creó fixtures. La ejecución posterior finalizó correctamente. No se detectaron fallos funcionales del frontend en las comprobaciones ejecutadas ni se modificó el backend.

## Datos propios y límites

Ejecución `QA_M8_20261111225636`: área 20, cuentas 1020/1021 y registro 10041. Ambas cuentas y el área quedaron desactivadas al finalizar. El registro, sus modificaciones, la bitácora y las tres alertas QA permanecen identificados en la base de pruebas; no se borró trazabilidad ni se gestionaron alertas. La cuenta de eventos recibió los cinco fallos propios del caso y quedó desactivada posteriormente. No se hicieron intentos incorrectos sobre usuarios anteriores ni sobre admin.

Las credenciales y JWT solo se procesaron en memoria/entrada oculta; no se guardaron en código, pruebas, archivos, capturas ni registros. Para repetir manualmente ejecutar `node scripts/validate-module-8.mjs --ui`, suministrar las dos credenciales ocultas solicitadas y pulsar Enter tras terminar el navegador. La precondición de umbrales pequeños limita el volumen; si no se cumple se detiene la prueba sin cambiar reglas.

La prueba positiva de fuera de horario cubrió **login exitoso**, no modificación financiera fuera de horario. No se forzaron todas las fronteras de días/horas, eventos con JSON inválido ni despliegues con varios procesos de API. No se realizaron pruebas de carga masiva ni una matriz completa de navegadores. La pérdida real de red, respuestas malformadas y el doble clic tienen cobertura automatizada simulada; no se presentan como fallos reales inducidos contra la API.

Consulta de parámetros vigentes, edición de reglas y desglose de resultados no están disponibles en la API actual. La gestión de alertas queda pendiente del Módulo 9. Las limitaciones documentadas de módulos previos siguen vigentes y no se repitió su aceptación real completa; sí se ejecutó la suite automatizada completa por los cambios de permisos/navegación compartidos.
