# CFA · Validación integral, bloque 3

**Actualización posterior:** [reanudación del bloque 3](validacion-bloque-3-reanudacion.md) acredita O9 con corte TCP real. La alerta 142 quedó Resuelta, con versión nueva y un único cierre; su estado En revision descrito abajo es histórico. El usuario acreditó también el recorrido manual de Chrome/Edge y la revisión de Excel: O10 cerrada. El fixture 1030/área 25 ya quedó inactivo y el relé cerrado, confirmado al terminar el handoff. Véase la [propuesta documental de O3/O6 y suspensión](propuesta-bloque-4.md); no se ejecutó el siguiente bloque.

Fecha: **12/11/2026 (Perú)**. Resultado actualizado: **O9 pendiente; revisión de exportaciones en Excel confirmada manualmente por el usuario; compatibilidad Chrome/Edge pendiente**. La interrupción del control de Windows se conserva como antecedente de la ejecución del agente. No se repitieron O1/O2/O4/O5/O7/O8, matrices funcionales ni cargas. O3/O6 no ejecutadas. La suspensión real de O1 pasa a comprobación **complementaria pendiente**, según la aprobación expresa del usuario al iniciar este bloque; la expiración normal de O1 está aprobada y no se repitió.

## Seguridad del entorno y preparación

Se comprobó que el proceso de la API en 7202 mantiene sesiones SQL exclusivamente en **ControlFinancieroDB_Pruebas** antes de preparar fixtures y antes de cada petición del arnés, incluidas las de limpieza. No se modificó/inició el backend ni se cambiaron migraciones, certificados globales, reglas, relojes o la base principal.

Ejecución **QA_B3_20261112104149**: área **25**, Auditor QA **1030**, `qa_b3_20261112104149.auditor`. Solo se preparó ese usuario y esa área. El primer lector auxiliar no interpretaba una consulta SQL sin filas; se corrigió para devolver una lista vacía. Sus fixtures se habían desactivado correctamente y se reutilizaron al reanudar, sin crear otro conjunto ni restablecer otra vez la contraseña.

Credenciales y JWT permanecieron exclusivamente en memoria/entrada oculta. Las evidencias guardadas no contienen tokens ni contraseñas. No hubo cambios de código de aplicación.

## O9 · Preparada, no ejecutada contra Angular

Se reservó la alerta QA **142**, procedente de M9 y preparada En revision por O8; no se repitió el inicio de revisión. Estado inicial consultado realmente por API:

- Estado **En revision**, `RowVersion = AAAAAAAA8kI=`.
- **Cero cierres** previos en bitácora.
- Evidencia: [o9-antes.json](evidencias-bloque-3/o9-antes.json).

Se preparó `scripts/validate-block-3.mjs` con un relé HTTP/TCP local en **127.0.0.1:4300**, independiente de la configuración Angular de producción. La ruta real permanece Angular/Vite → **HTTPS 7202**. Su mecanismo previsto es reenviar una única solicitud QA de cierre real, romper su socket antes de entregar al navegador la respuesta del servidor y mantener interrumpidas las peticiones de API hasta la recuperación expresa. No fabrica una respuesta HTTP ni detiene la API. El cierre exige prefijo QA, estado autorizado y la versión de esta alerta; se cuentan intentos y reenvíos.

**Ese mecanismo NO se activó ni ejecutó.** El acceso inicial del navegador al puerto 4300 ocurrió antes de que acabara la preparación del relé y recibió conexión rechazada; **eso no acredita una interrupción durante una escritura**. Tras corregir el lector, el relé quedó disponible, pero se detuvo el control de interfaz antes de iniciar sesión o armar el caso.

Al intentar observar la ventana nativa de Chrome, el control de Windows se detuvo porque no pudo verificar la URL actual con suficiente confianza. No se reintentó mediante otro mecanismo de UI ni se presentó una prueba HTTP de consola como sustituto de Angular.

SQL final de solo lectura confirmó **142 / En revision / AAAAAAAA8kI=**, con **cero CierreAlerta**. No hubo una escritura financiera/alerta O9 ni un conflicto funcional que corregir. La salida no exitosa del arnés corresponde a su guard de finalización —no había reconciliación ejecutada— y ejecutó la limpieza, no a un fallo demostrado del frontend.

**Falta para aprobar:** recorrido real de Angular con el relé, confirmación de un cierre QA durante el corte TCP, observación del error/bloqueo, recuperación y consulta de **estado + nueva o misma RowVersion + bitácora antes de cualquier otra escritura**; verificar intentos y ausencia de reenvío automático. Si ya quedó cerrado, no intentar cerrar de nuevo. Conservar evidencia del punto real de corte; no afirmar que se interrumpió una transacción SQL interna ni suponer rollback.

## O10 · Exportaciones por API y revisión manual confirmada en Excel

Se reutilizó exclusivamente el documento QA **12** del bloque 2, área **24**, fecha **12/11/2026**; no se importaron ni crearon registros nuevos.

Comprobaciones realmente ejecutadas:

- API de resumen y detalle: **HTTP 200**, referencias JSON guardadas en [o10-referencia-api.json](evidencias-bloque-3/o10-referencia-api.json).
- Exportación de documento: **HTTP 200**, [o10-documento.xlsx](evidencias-bloque-3/o10-documento.xlsx), **24215 bytes**.
- Exportación de resumen: **HTTP 200**, [o10-resumen.xlsx](evidencias-bloque-3/o10-resumen.xlsx), **6910 bytes**.
- Exportación de detalle: **HTTP 200**, [o10-detalle.xlsx](evidencias-bloque-3/o10-detalle.xlsx), **25785 bytes**.

Referencias reales que deben contrastarse **dentro de la aplicación destinataria**:

| Elemento                              | Valor esperado según la API y el conjunto QA ya acreditado                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Documento/detalle                     | **500 registros**, IDs **10047–10546**, todos con fecha de operación **12/11/2026**              |
| Identificación                        | `QA_B2_20261112095714 O5 FILA_0001`–`FILA_0500`, área `QA_B2_20261112095714_A`, documento **12** |
| Ingresos                              | **250**, total **625.00**                                                                        |
| Egresos                               | **250**, total **627.50**                                                                        |
| Resumen                               | Diferencia **−2.50**; no es saldo disponible ni presupuesto restante                             |
| Suma de importes de documento/detalle | **1252.50**, mínimo **0.01**, máximo **5.00**                                                    |
| Fechas del reporte                    | Desde/hasta **12/11/2026**; generación identificada como **UTC**, no confundir con hora de Perú  |

**Ejecución del agente:** Microsoft Excel está instalado y se inició realmente. Se encontró un aviso de cuenta/privacidad bloqueante; el usuario confirmó haberlo atendido. El bloqueo posterior del control de Windows impidió al agente abrir los tres archivos. No se presenta ese intento como una revisión ejecutada por el agente ni se sustituye con ZIP/XML.

**Comprobación manual posterior, recibida del usuario el 12/11/2026:** abrió personalmente los tres archivos en **Microsoft Excel**, sin errores ni solicitudes de reparación. Confirmó visualmente **500 registros**, IDs **10047–10546**, datos del detalle financiero y resumen con **250 ingresos / 625.00**, **250 egresos / 627.50** y **diferencia −2.50**. No comunicó discrepancias.

Evidencia atribuida a su ejecutor: [confirmación manual](evidencias-bloque-3/o10-confirmacion-manual.md). **La apertura y las comprobaciones de contenido comunicadas quedan aprobadas como prueba manual real del usuario**, no como automatización ni observación del agente. Las fechas y demás controles de la tabla son referencias de contraste; no se añaden comprobaciones desglosadas no comunicadas. No se repitió el caso extremo conocido de precisión del servidor.

**O10 sigue parcial por la compatibilidad en navegador**, que esta revisión en Excel no acredita. No hace falta repetir la apertura y los conteos/totales ya confirmados.

## Chrome y Edge · Disponibles, compatibilidad no verificada

- Chrome: se identificó una ventana real abierta. El conector de navegador Chrome no estaba disponible; la observación nativa se detuvo por la verificación de URL. No se llegó a recorrer CFA.
- Edge: se confirmó instalado en `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`. No se inició una revisión funcional después del bloqueo.

La presencia de ambos navegadores **no acredita compatibilidad**. Pendiente una revisión breve de login/Inicio, tablas de registros/documentos, reportes y alertas con datos QA, sin matrices ni carga. No se usó el navegador integrado como sustituto de Chrome o Edge.

## Limpieza, correcciones y continuación

Limpieza de la preparación confirmada por API y SQL final: usuario **1030** y área **25** inactivos. El relé se cerró. La alerta **142** sigue En revision y conserva su RowVersion inicial y cero cierres; no se modificó ningún registro ajeno. Se conservan archivos y trazabilidad de consultas/exportaciones.

**Corrección realizada:** lector auxiliar para SQL vacío; no se encontró ni corrigió un defecto de aplicación. No se ejecutaron pruebas simuladas nuevas ni compilación de producción, porque no hubo cambios de aplicación. Un arnés preparado, una apertura de Excel bloqueada o un HTTP 200 no se cuentan como una prueba visual aprobada.

Para retomar, comprobar primero conexión efectiva y estado real de la alerta 142. El modo de reanudación del arnés solo permite reutilizar sus IDs QA propios 1030/25 y vuelve a desactivarlos al terminar. No activar ni cerrar nada antes de resolver el acceso de interfaz o acordar un recorrido manual verificable. O3/O6 continúan separados, sin preparación incidental.
