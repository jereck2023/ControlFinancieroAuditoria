# CFA · C-O1-SUSP: suspensión real de Windows

**Estado: aprobada realmente.** Fecha: 12/11/2026 (Perú). Suspensión ejecutada manualmente por el usuario y corroborada por eventos de Windows; comprobaciones de Angular/API realizadas por el agente después de reanudar. O3 y O6 no se ejecutaron ni se generaron datos para ellas.

## Resultado real

| Comprobación                    | Evidencia                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Suspensión real                 | Evento **Microsoft-Windows-Power-Troubleshooter, ID 1, RecordId 11285**, con `SleepTime` **23:49:15.5782234 UTC = 18:49:15 Perú** y `WakeTime` **23:54:34.9414670 UTC = 18:54:34 Perú**. Kernel-Power 42, RecordId 11278, también registrado. El usuario confirmó haber suspendido a las 18:49 y reanudado después de las 18:54, sin cerrar sesión ni recargar CFA |
| Vencimiento atravesado          | `exp` del mismo JWT **23:51:40 UTC = 18:51:40 Perú**, estrictamente entre SleepTime y WakeTime. Duración de suspensión aproximada **319.363 segundos**                                                                                                                                                                                                             |
| Angular antes del F5 del agente | A **23:56:11.408 UTC = 18:56:11 Perú**, se observó `/login`, formulario de credenciales vacío y ausencia de sesión autenticada. **No se observó un mensaje explícito de sesión vencida**; no se atribuye un instante exacto al temporizador ni un mecanismo específico de recarga automática                                                                       |
| F5 posterior                    | A **23:56:23.425 UTC = 18:56:23 Perú**, permaneció en `/login`, sin restaurar acceso ni introducir credenciales                                                                                                                                                                                                                                                    |
| API después de reanudar         | Conexión efectiva a base de pruebas verificada nuevamente; a **23:58:15.960 UTC = 18:58:15 Perú**, `/api/registros-financieros` rechazó con **HTTP 401 el mismo JWT que recibió Angular**, conservado solo en memoria del relé. Antes de la suspensión ese JWT obtuvo HTTP **200**                                                                                 |
| Invariante                      | Estado de cuenta, contraseña mediante SecurityStamp, roles, área e indicador de cambio obligatorio iguales a la instantánea inicial hasta finalizar las verificaciones; la limpieza ocurrió después                                                                                                                                                                |
| Limpieza                        | Cuenta **2025** y área **1023** desactivadas por API con destino efectivo verificado; SQL posterior confirmó ambas inactivas. Relé y proceso auxiliar detenidos; token/credenciales no se conservaron en archivos                                                                                                                                                  |

Se acredita **suspensión real de Windows atravesando la expiración**, bloqueo de acceso al regresar, F5 sin recuperar sesión y rechazo del mismo JWT por el servidor. No se simularon eventos de visibilidad ni se cambió el reloj, duración del JWT o configuración del backend. La evidencia de suspensión no depende únicamente de una pausa del temporizador.

Fuentes verificables: [resultado consolidado](evidencias-suspension/QA_SUSP_20261112231936/resultado.json), [metadatos y eventos de energía](evidencias-suspension/QA_SUSP_20261112231936/evidencia.json), [estado tras reanudar](evidencias-suspension/QA_SUSP_20261112231936/reanudacion.jpg) y [F5 posterior](evidencias-suspension/QA_SUSP_20261112231936/f5-reanudacion.jpg). La confirmación del usuario corresponde al mensaje de reanudación recibido en el chat; las lecturas del navegador, HTTP y eventos son comprobaciones reales del agente.

## Preparación real completada

- Verificada conexión efectiva del proceso API en 7202 exclusivamente a **ControlFinancieroDB_Pruebas** antes de preparar datos; el arnés la exige antes de cada petición que puede escribir y de sus consultas SQL.
- Fixture dedicado **QA_SUSP_20261112231936**: cuenta **2025**, `qa_susp_20261112231936.sesion`, rol **PersonalArea**, área **1023**. La credencial obligatoria de preparación se completó mediante API **antes** de emitir el JWT probado. No se modificaron cuenta/roles/contraseña/área durante la espera.
- Angular estaba detenido; se inició únicamente su servidor de desarrollo en **4200**. No se inició ni modificó el backend, migraciones, reloj, duración de token ni configuración de producción.
- Sesión real iniciada en el navegador integrado, **http://localhost:4301/inicio**, mediante un relé local de observación hacia Angular 4200 y su proxy **HTTPS 7202**. Se retransmitió sin modificar la respuesta real de login; **el mismo JWT que recibió Angular** se conservó únicamente en memoria del arnés hasta verificar su rechazo posterior. No se inyectó sesión en el navegador ni se almacenó/imprimió JWT o contraseña en archivos o evidencias.
- El mismo JWT fue admitido por `/api/registros-financieros`: **HTTP 200** antes del vencimiento. Se observó Inicio autenticado y pie **Sesión hasta 18:51**. No se crearon registros financieros.

## Ventana manual acordada (histórico)

Todas estas horas son del **12/11/2026, America/Lima (Perú)**:

| Acción                                                    | Hora                            |
| --------------------------------------------------------- | ------------------------------- |
| Suspender Windows mediante Inicio → Encendido → Suspender | **18:49:00**                    |
| `exp` real del mismo JWT del navegador                    | **18:51:40** = **23:51:40 UTC** |
| Reanudar Windows                                          | **18:54:00 o después**          |

Se indicó mantener abiertos Angular, API, arnés y pestaña autenticada, sin apagar, reiniciar, cerrar sesión o cambiar reloj/configuración. El usuario confirmó el cumplimiento y avisó antes del F5 del agente. Esta ventana ya terminó: no ejecutarla nuevamente.

Una suspensión iniciada después del `exp`, una pestaña en segundo plano o el bloqueo de pantalla no habrían sustituido este caso. Se consultaron eventos reales de energía y se comprobó que el intervalo atravesó el `exp`.

## Trazabilidad de ejecución y cierre

- [Metadatos sin secretos](evidencias-suspension/QA_SUSP_20261112231936/evidencia.json).
- [Inicio autenticado antes de suspender](evidencias-suspension/QA_SUSP_20261112231936/antes.jpg).
- Arnés `scripts/validate-windows-suspension.mjs`, terminal **43860**, no se reinició entre captura del JWT y comprobación posterior. La API/SQL estuvieron disponibles con destino efectivo correcto antes de enviar `resumed`. No se emitió un JWT sustituto.
- Pestaña integrada **1**, inicialmente 4301/inicio; observada en 4301/login tras reanudar y después de F5. No se repitió compatibilidad Chrome/Edge.
- `resumed` verificó HTTP 401, invariante y eventos de Windows; `finish` volvió a comprobar el invariante y desactivó únicamente 2025/1023. SQL confirmó limpieza.
- Una conexión WebSocket auxiliar de desarrollo quedó abierta después de terminar las comprobaciones y la limpieza. Se detuvo el proceso auxiliar y se ajustó el cierre de conexiones del arnés para futuras ejecuciones. **No se declara salida natural con código 0** ni se presenta ese cierre auxiliar como un defecto de sesión de CFA. No se repitió la suspensión tras ese ajuste de recursos.

No hubo defectos funcionales demostrados ni cambios de código de aplicación. Se comprobó sintaxis del arnés; no se repitieron la suite simulada ni la compilación de producción. El arranque de desarrollo no se presenta como una nueva validación de producción. **Pendientes obligatorios restantes: O3 y O6**, aún sin ejecutar ni generar datos para ellos.
