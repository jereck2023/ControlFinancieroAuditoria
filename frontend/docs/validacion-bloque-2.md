# CFA · Validación integral, bloque 2

Fecha: **12/11/2026 (Perú)**. Alcance autorizado: **O1, O5 y O8**. Se conservan las aprobaciones del bloque 1; no se repitieron O2/O4/O7, matrices de roles ni rechazos de importación ya aprobados. No se ejecutaron O3/O6/O9/O10.

## Entorno y fixtures

Se comprobó la conexión efectiva exclusiva a **ControlFinancieroDB_Pruebas**, relacionando el proceso que escucha en 7202 con sus sesiones SQL, antes de las peticiones del arnés y de las escrituras desde Angular. No se inició ni modificó el backend ni se alteraron migraciones, configuración, relojes o la base principal. Todas las consultas SQL fueron de solo lectura.

Ejecución **QA_B2_20261112095714**, área nueva **24**. Cuentas QA: **1027** `.sesion` (PersonalArea), **1028** `.importacion` (PersonalArea) y **1029** `.auditor` (Auditor). Las contraseñas obligatorias de preparación se establecieron mediante API **antes** de iniciar O1; esa preparación no se cuenta como repetición visual de O2. Credenciales y JWT solo se procesaron en memoria/entrada oculta, sin persistirlos ni imprimirlos.

No había una importación positiva de 500 filas acreditada que pudiera reemplazar O5. Se preparó un único documento; los 500 registros persistidos permanecen disponibles para futuras preparaciones autorizadas, sin volver a importarlos. Para O8 se reutilizaron alertas QA ya existentes de M9 y no se generaron once alertas nuevas.

## O5 · Aprobada realmente

Archivo **QA_B2_20261112095714_O5_500.xlsx**, **13859 bytes**, inferior a **2097152 bytes (2 MiB)**. Hoja `RegistrosFinancieros`, cuatro encabezados exactos y **500 filas de datos**, además del encabezado; sin fórmulas. Fecha de operación 12/11/2026 en el formato textual admitido `dd/MM/yyyy`. Las descripciones identifican consecutivamente `FILA_0001`–`FILA_0500`; operaciones alternas Ingreso/Egreso e importes de 0.01 a 5.00.

| Comprobación real                   | Resultado                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Vista previa mediante Angular/API   | **500 filas revisadas · 500 registros válidos · 0 observaciones**                                                         |
| Primera página                      | **Página 1 de 50**, filas de datos 1–10; primera fila Excel 2, Ingreso 0.01, `FILA_0001`                                  |
| Última página                       | **Página 50 de 50**, filas de datos 491–500; última fila Excel 501, Egreso 5.00, `FILA_0500`; Siguiente deshabilitado     |
| Persistencia antes de confirmar     | Cero documentos y cero registros del actor 1028, incluso después de la vista previa                                       |
| Confirmación en Angular             | Una confirmación; **500 registros importados**, enlace al documento **12**                                                |
| SQL posterior                       | Exactamente **500 registros**, **500 descripciones e índices distintos**, documento **12**, área **24**, usuario **1028** |
| Correspondencia íntegra             | **500 de 500** coinciden en descripción exacta, índice 1–500, operación, fecha, monto, documento y área                   |
| Trazabilidad                        | **500 historiales** del actor; registros **10047–10546**                                                                  |
| Importes de control                 | Ingresos: **250 / 625.00**; egresos: **250 / 627.50**; suma de importes **1252.50**                                       |
| Archivo original frente a documento | SHA-256 idéntico: `4584E4A3F80C5D052B9AFC4EBE8C1DC96FFA55E9B1498CD0842056401D98C443`                                      |

Evidencia: [persistencia.json](evidencias-bloque-2/persistencia.json), [primera página](evidencias-bloque-2/o5-primera-pagina.jpg), [última página](evidencias-bloque-2/o5-ultima-pagina.jpg), [confirmación](evidencias-bloque-2/o5-confirmacion.jpg) y [archivo QA conservado](evidencias-bloque-2/QA_B2_20261112095714_O5_500.xlsx). El XLSX se generó con las bibliotecas incluidas en el entorno; no se añadieron dependencias a CFA. La apertura en Excel institucional sigue siendo O10 y no se considera aprobada por esta importación.

**Error funcional encontrado:** ninguno. **Corrección de aplicación:** ninguna. No se probaron de nuevo fila 501, archivos inválidos ni cargas mayores.

## O8 · Aprobada realmente

Se aislaron **once alertas QA Pendiente** ya existentes, pertenecientes a `qa_m9_20261111232036.auditor` (**1022**). Filtros reales:

- Estado **Pendiente**, regla **2** `FUERA_DE_HORARIO`, usuario **1022**.
- Evento UTC desde **11/11/2026 23:24:42** hasta **11/11/2026 23:28:58** inclusive al segundo.
- Área sin filtro, tamaño **10**. Son alertas QA de login; su origen es válido para probar paginación, y **no se utilizó como repetición ni evidencia de O7**.

El listado mostró **11 resultados / página 1 de 2**. Al avanzar a la página 2, su única fila era la alerta **142**, Pendiente. Se abrió su detalle y se inició revisión mediante confirmación real en Angular con el Auditor QA **1029**, verificando la base efectiva inmediatamente antes del guardado.

Después de esa única operación:

- Angular ajustó automáticamente a **10 resultados / página 1 de 1**, sin quedarse en la página vacía.
- Se conservaron estado, regla, usuario, fechas, área sin filtro y tamaño **10** en los controles; no se limpiaron ni ampliaron filtros.
- El detalle permaneció abierto y actualizado a **En revisión**, responsable **1029** y mensaje `Revision iniciada correctamente`.
- SQL confirmó estado y responsable, inicio **2026-11-12T10:02:43.6923641 UTC**.
- La bitácora contiene exactamente **una** actividad de éxito del actor: **823**, `InicioRevisionAlerta`, **2026-11-12T10:02:43.6925976 UTC**, `AlertaId=142; EstadoAnterior=Pendiente; EstadoNuevo=En revision.` No se duplicó la escritura.

Evidencia: [antes](evidencias-bloque-2/o8-antes.jpg), [después](evidencias-bloque-2/o8-despues.jpg) y [consulta persistida](evidencias-bloque-2/persistencia.json). La alerta **142** se conserva **En revision** para trazabilidad y posible uso posterior autorizado; no se cerró ni reabrió. Las demás alertas del conjunto permanecieron sin cambios.

**Error funcional encontrado:** ninguno. **Corrección de aplicación:** ninguna. Se ajustaron nombres de campos en una consulta auxiliar de evidencia antes de recoger el resultado válido; esa consulta fallida fue de solo lectura y no modificó datos.

## O1 · Parcial: expiración natural aprobada; suspensión real pendiente

Actor exclusivo **1027**, área **24**. No se modificaron estado, contraseña, roles ni área durante la espera. El arnés comparó una instantánea en memoria de estado/área/roles/indicador de cambio y SecurityStamp, sin volcar este último a evidencias. El invariante se conservó al comprobar el rechazo por expiración y hasta terminar el recorrido de navegador.

- Login HTTP iniciado **09:57:48.761 UTC**. JWT real retenido solo en memoria, `exp` **12/11/2026 10:27:49 UTC = 05:27:49 Perú**. Petición protegida antes de ese `exp`: **HTTP 200**.
- Login independiente de Angular: **09:58:03.614–09:58:04.002 UTC**. Se observó Inicio y el pie **Sesión hasta 05:28**. Es otro JWT emitido por la misma API para la misma cuenta; no se afirma que sea el token de la comprobación HTTP ni se extrajo del almacenamiento del navegador.
- A **10:18:53.664 UTC**, Angular continuaba en Inicio con la sesión vigente.
- El backend revisado valida la vida del token con `ClockSkew = TimeSpan.Zero`. El cliente usa el `exp` del JWT, sin vencimiento renovable.

| Comprobación real de expiración normal       | Resultado                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API después del `exp`                        | A **10:27:53.975 UTC**, el mismo JWT conservado desde el inicio recibió **HTTP 401** en `/api/registros-financieros`; `exp` real **10:27:49 UTC**. No hubo renovación ni login intermedio de esa prueba HTTP |
| Angular todavía autenticado antes de expirar | Inicio observado a **10:27:36.296 UTC**, con sesión hasta **05:28 Perú**                                                                                                                                     |
| Angular después de expirar                   | A **10:28:19.906 UTC**, ruta `/login`, mensaje **Su sesión ha vencido. Ingrese nuevamente sus credenciales.**, formulario de credenciales vacío. No se pulsó cerrar sesión en esa pestaña                    |
| F5 posterior                                 | A **10:28:27.148 UTC**, permaneció en `/login`, sin recuperar acceso ni renovar la sesión; volvió a solicitar credenciales                                                                                   |
| Invariante de seguridad                      | Cuenta, área, roles, indicador y SecurityStamp iguales al inicio de la espera y al terminar navegador; la limpieza se hizo después                                                                           |

**Expiración normal: aprobada realmente. O1 completo: parcial**, porque la comprobación de suspensión real del plan sigue pendiente. Se observó el estado de Angular antes y después del vencimiento, no se instrumentó el instante exacto de ejecución de su temporizador ni se leyó el JWT del navegador. El JWT HTTP y el del login de Angular son independientes; se distingue expresamente su evidencia.

Evidencia sin credenciales: [metadatos y resultados](evidencias-bloque-2/o1-expiracion.json), [antes](evidencias-bloque-2/o1-antes.jpg), [sesión vencida](evidencias-bloque-2/o1-expirado.jpg) y [F5 posterior](evidencias-bloque-2/o1-f5.jpg).

**Error funcional encontrado:** ninguno. **Corrección de aplicación:** ninguna.

**Suspensión real:** se propuso la intervención manual necesaria para suspender/reanudar el equipo atravesando el vencimiento; el usuario eligió expresamente **mantener el equipo activo y dejar esa comprobación pendiente**. No se enviaron eventos de foco/visibilidad artificiales ni se cambió el reloj. Una pestaña en segundo plano no se presenta como suspensión real del equipo o del proceso.

## Cierre y alcance de las comprobaciones

**Limpieza completada después de O1 normal**, con conexión exclusiva verificada antes de cada petición. El arnés terminó con código **0**. SQL final confirmó cuentas **1027/1028/1029** y área **24** inactivas; las tres cuentas conservan `DebeCambiarPassword=false`. Se conservan los 500 registros, documento 12, historiales, bitácora y alertas QA. La alerta 142 permanece En revision; no se crearon registros financieros adicionales a los 500 requeridos. Las sesiones auxiliares de navegador se cerraron localmente y la sesión dedicada expiró por sí misma.

**Estado de cierre:** O5/O8 aprobadas; O1 normal aprobada y solo su suspensión real pendiente por decisión expresa del usuario. No volver a ejecutar O5/O8 ni repetir la expiración normal como una batería independiente. Para cerrar el resto de O1 hará falta una sesión QA dedicada nueva y una suspensión/reanudación real que atraviese su vencimiento, sin cambiar relojes/configuración ni simular eventos. No se declara ese caso aprobado por mantener una pestaña en segundo plano.

Las comprobaciones de este informe son **integración real** con Angular/API/SQL, no HTTP simulado. No se ejecutó de nuevo la suite de 142 pruebas/32 archivos ni la compilación de producción: no hubo cambios de aplicación que lo justifiquen. Los nuevos arneses y este informe están únicamente dentro de frontend. Una compilación o prueba simulada no se utiliza para cerrar ninguno de estos casos reales.
