# CFA · Reanudación del bloque 3

Fecha: **12/11/2026, Perú**. Este informe actualiza los estados de [la preparación anterior](validacion-bloque-3.md), conservada como historial. **O9 aprobada mediante interrupción TCP real y Angular/API/SQL; O10 acreditada posteriormente mediante el recorrido manual del usuario en Chrome y Edge.** Excel no se volvió a abrir.

## Entorno

Antes de reactivar fixtures y de las peticiones del relé/arnés se verificó que el proceso de API en 7202 mantiene sesiones SQL exclusivamente en **ControlFinancieroDB_Pruebas**. Se reutilizaron únicamente cuenta QA **1030** y área **25**, ejecución **QA_B3_20261112104149**. No se crearon cuentas, áreas, registros financieros ni alertas adicionales. No se modificaron backend, migraciones, configuración de producción, certificados globales, reglas ni relojes.

## O9 · Interrupción real de respuesta y reconciliación

Se cargó Angular desde **http://localhost:4300**, un relé local de transporte hacia el frontend habitual en 4200 y su proxy **HTTPS 7202**. El navegador envió un cierre real sobre la alerta QA **142**, ya En revision, con una justificación identificada por el prefijo de la ejecución. No se utilizó un mock de HTTP ni una respuesta fabricada.

| Hito real                                         | Evidencia                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Estado inicial leído por API                      | **En revision**, versión **AAAAAAAA8kI=**, cero actividades de cierre                                                                                                                |
| Relé armado, tras verificar base                  | **11:03:43.887 UTC**                                                                                                                                                                 |
| Solicitud de cierre recibida                      | **11:03:56.984 UTC**, **1 intento**                                                                                                                                                  |
| Envío hacia API real                              | **11:03:58.161 UTC**, **1 reenvío al servidor**                                                                                                                                      |
| Rotura de conexión                                | **11:03:58.201 UTC**: llegó respuesta real del servidor, HTTP 200, y se destruyó el socket del cliente **sin entregarle los encabezados ni el cuerpo**                               |
| Pérdida sostenida de transporte                   | Se destruyeron también los sockets de los GET de detalle/listado que Angular solicitó para reconciliar; sin generar errores HTTP ficticios                                           |
| Angular desconectado                              | Mostró error de conexión y **No se pudo confirmar el cambio**; solicitó lecturas, conservó justificación y **bloqueó Confirmar cierre** mientras no podía consultar el estado actual |
| Recuperación de conexión                          | **11:04:25.877 UTC**, sin reenviar la escritura                                                                                                                                      |
| Consulta API/SQL antes de cualquier nuevo intento | **11:04:28.377 UTC**: estado **Resuelta**, versión **AAAAAAAA9Ec=**, cierre del usuario **1030**, una única actividad de éxito                                                       |
| Bitácora                                          | **858**, `CierreAlerta`, `Exitoso`, **11:03:58.1880843 UTC**, alerta 142, En revision → Resuelta                                                                                     |
| Lectura posterior en Angular                      | Actualizar detalle mostró **Resuelta**, usuario 1030, fecha y justificación guardadas; sin formulario de cierre ni reapertura                                                        |

**Resultado:** la operación se guardó aunque Angular perdió la respuesta. No se afirmó rollback ni se supuso que había fallado. Hubo **un intento de cierre y un envío real**, sin repetición automática ni segundo cierre. El relé detectaría y registraría un intento adicional incluso si lo bloqueara; la bitácora única no es el único indicador utilizado para descartar reenvíos.

**Límite de lo ejecutado:** el corte ocurrió con la operación todavía pendiente para Angular, después de que el servidor hubiera producido una respuesta. Se probó una **pérdida real de respuesta TCP**, no una interrupción forzada dentro de la transacción SQL ni un corte de todo Windows. La API continuó funcionando y no se cambió el adaptador de red.

Evidencia sin credenciales:

- [Estado inicial](evidencias-bloque-3/o9-antes.json).
- [Eventos de transporte](evidencias-bloque-3/transporte.json).
- [Estado, RowVersion y bitácora tras recuperación](evidencias-bloque-3/o9-despues-recuperacion.json).
- [Confirmación preparada](evidencias-bloque-3/o9-confirmacion.jpg), [desconexión real](evidencias-bloque-3/o9-desconexion.jpg), [reconciliación inicial](evidencias-bloque-3/o9-reconciliacion.jpg) y [lectura final](evidencias-bloque-3/o9-estado-final.jpg).

## Corrección puntual del frontend y comprobaciones

Se observó que los mensajes anteriores de error/incertidumbre seguían visibles tras una actualización manual exitosa del detalle. Se corrigió en **alerts-page.ts**: solo una lectura manual **exitosa y con RowVersion válida** reconoce la recuperación y limpia esos mensajes. Una lectura fallida mantiene la advertencia y el bloqueo; la recarga automática después de un 409 conserva su explicación de conflicto.

Se añadió una regresión en **alerts-page.spec.ts** para pérdida de respuesta, recarga fallida, bloqueo de escritura, recuperación manual a Resuelta y ausencia de otro POST. La aserción comprueba `:disabled`, porque el bloqueo del formulario se hereda del fieldset.

- **HTTP simulado:** `npm.cmd test -- --include=src/app/features/alerts/pages/alerts-page.spec.ts` → **8 pruebas aprobadas en 1 archivo**. No se ejecutó toda la suite histórica ni se sumó este resultado como si fuera otra batería real.
- **Compilación de producción:** `npm.cmd run build` → exitosa; carga inicial **520.93 kB**, módulo diferido de alertas **27.31 kB**. Esto no sustituye pruebas de integración.
- **API/navegador real:** el corte y la primera reconciliación ocurrieron antes del ajuste visual. Después se volvió a consultar la alerta ya cerrada desde Angular y se observó estado final limpio, sin realizar otro cierre. **No se repitió una segunda interrupción con escritura tras la corrección**; la secuencia de eliminación de mensajes quedó cubierta por la regresión simulada, sin atribuirle ejecución real adicional.

## O10 · Chrome/Edge acreditados mediante intervención manual

El usuario abrió **http://localhost:4200/login** en ambos navegadores, sin iniciar sesión. Se identificaron las ventanas reales `Ingresar | CFA - Google Chrome` y `Ingresar | CFA - Personal: Microsoft Edge`. Chrome estaba minimizado; al intentar restaurarlo mediante el control documentado, Windows volvió a detener la automatización porque no pudo verificar la URL con suficiente confianza. No se intentó sortear el bloqueo con otra vía de UI.

El intento automático no aprobó compatibilidad. **Después, el usuario confirmó haber completado el recorrido manual solicitado en Google Chrome y Microsoft Edge**, incluyendo login, Inicio, documentos, registros, reportes y alertas. Verificó documento 12/500 registros, totales 625.00/627.50/−2.50 y detalle de alerta 142; no encontró errores visibles y cerró sesión. [Confirmación manual atribuida al usuario](evidencias-bloque-3/o10-chrome-edge-manual.md). Esta evidencia cierra el recorrido breve de O10, sin atribuirlo al agente ni a una matriz exhaustiva. La prueba manual previa de Excel sigue vigente y no se repitió.

## Handoff y pendientes

**Handoff y limpieza completados.** Tras la confirmación del usuario se envió `finish` al arnés: comprobó un intento/un envío sin cierre repetido, desactivó únicamente usuario **1030** y área **25**, cerró el relé y terminó con código **0**. Su verificador exigió conexión exclusiva a la base de pruebas antes de cada petición de limpieza. SQL posterior confirmó ambos inactivos. No quedan activos los fixtures de este recorrido.

La sesión de navegador utilizada para O9 se cerró localmente. La alerta 142 se conserva **Resuelta**; no hay reapertura ni debe utilizarse como una nueva alerta En revision.

Pendientes obligatorios: **O3 y O6**. Complementaria pendiente: **C-O1-SUSP**, suspensión/reanudación real de Windows atravesando el vencimiento. [Propuesta del siguiente bloque](propuesta-bloque-4.md), solo documental, sin ejecutar O3/O6, preparar ambientes ni generar cargas. O1/O2/O4/O5/O7/O8 y Excel no se repitieron.
