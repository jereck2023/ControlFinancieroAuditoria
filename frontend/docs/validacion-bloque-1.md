# CFA · Validación integral, bloque 1

Fecha: **12/11/2026**. Alcance exclusivo: **O7, O4 y O2** del plan aprobado. O3/O6 no ejecutadas; no se repitieron matrices de roles, cargas ni validadores históricos.

## Entorno y protección de datos

Antes de las peticiones del arnés y de los guardados de navegador se comprobó el PID que escucha en 7202 y sus sesiones SQL: una única base efectiva, **ControlFinancieroDB_Pruebas**. Se utilizó el proxy HTTPS existente de Angular. No se inició ni modificó el backend, ni se cambiaron relojes, reglas, migraciones o la base principal. SQL se utilizó exclusivamente para consultas de evidencia.

Al iniciar, Angular no estaba escuchando en 4200 y la consulta CIM estaba bloqueada dentro del entorno restringido. Se inició `npm.cmd start` y se ejecutó la verificación con permisos de entorno suficientes. El primer intento se detuvo antes de escribir datos. Esto fue preparación del entorno, sin corrección de código de aplicación.

## O7 · Aprobada mediante evidencia real conservada

Se volvió a consultar la cadena de datos QA de M9; **no se ejecutó una detección nueva**. La evidencia previamente documentada era incompleta en su explicación; los datos conservados sí permiten acreditar la modificación específica.

| Elemento                           | Evidencia real consultada                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| Ejecución original                 | `QA_M9_20261111232036`                                                                            |
| Regla                              | `FUERA_DE_HORARIO`, activa; 08:00:00–18:00:00, días `1,2,3,4,5`                                   |
| Alerta                             | **161**, título `Modificación financiera fuera de horario`, estado conservado **Resuelta**        |
| Origen de la alerta                | `EvidenciasJson = {"HistorialAuditoriaId":69}`                                                    |
| Historial                          | **69**, `TipoAccion = Modificacion`, registro financiero **10044**, usuario **1023**              |
| Usuario y área                     | `qa_m9_20261111232036.jefe`, área **21** `QA_M9_20261111232036_A`                                 |
| Momento del evento y del historial | **2026-11-11T23:25:40.1282075 UTC** en ambos                                                      |
| Conversión a Perú                  | **11/11/2026 18:25:40.1282075**, desfase **−300 minutos**, miércoles                              |
| Momento de detección               | **2026-11-11T23:26:01.9298760 UTC**                                                               |
| Cambio auditado                    | Descripción `QA_M9_20261111232036 NAVEGADOR CAMBIO_2` → `QA_M9_20261111232036 NAVEGADOR CAMBIO_3` |
| Otros valores de la modificación   | Ingreso, fecha de operación 11/11/2026, monto 10.25; conservados en anterior/nuevo                |

La consulta relacionó `Alertas`, `ReglasAnomalia`, el ID extraído de `EvidenciasJson`, `HistorialesAuditoria`, `RegistrosFinancieros`, `AspNetUsers` y `Areas`. Las comprobaciones de igualdad de fecha, registro, usuario y área, existencia de un cambio real de descripción y hora fuera del tramo configurado devolvieron verdadero. La modificación ocurrió 25 minutos y 40 segundos después de las 18:00; no se utilizó la fecha de operación como sustituto de la hora auditada.

El historial financiero es el origen explícito de esta alerta. No es un login ni se infirió el origen de un contador de detección. Una búsqueda de bitácora por el mismo registro y ventana 23:25:35–23:25:45 UTC no devolvió filas; el endpoint de modificación revisado persiste el historial, sin insertar una actividad de modificación en bitácora. No se exige inventar una segunda referencia ausente del contrato para esta cadena. La bitácora de gestión de alertas fue acreditada en M9 y no se repitió.

**Error encontrado:** brecha documental, sin fallo funcional demostrado. **Corrección:** consolidar la cadena completa. No hace falta esperar otro horario, modificar datos ni reabrir la alerta.

## O4 · Aprobada contra API y SQL reales

Arnés dirigido: `scripts/validate-block-1.mjs`; recibe la credencial administrativa mediante entrada oculta y genera credenciales de preparación solo en memoria. Antes de cada petición/consulta exige la base de pruebas. Las descripciones vacías se permiten en el arnés únicamente para el actor financiero QA de esa ejecución; se mantienen los controles de propiedad de IDs.

Fixtures: ejecución **QA_B1_20261112091337**, área **23**, actor API **1025**, registro de control **10046**. La preparación del actor y su contraseña mediante API no se cuenta como prueba visual O2.

| Caso real enviado                                              | Resultado    | Persistencia comprobada                                                          |
| -------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| POST descripción `""`                                          | HTTP **400** | Cero registros/cero historiales del actor, iguales al estado previo              |
| POST descripción `"   "`                                       | HTTP **400** | Cero registros/cero historiales, sin cambios                                     |
| PUT registro 10046, descripción `""`, versión actual válida    | HTTP **400** | GET posterior idéntico al original, incluida RowVersion; sin historial adicional |
| PUT registro 10046, descripción `"   "`, versión actual válida | HTTP **400** | GET posterior idéntico al original, incluida RowVersion; sin historial adicional |

Entre los casos negativos se creó intencionalmente un único registro válido `QA_B1_20261112091337 O4_BASE`, Ingreso 10.25. Al terminar O4: **1 registro, 1 historial de creación, 0 historiales de modificación** del actor. Ese registro válido no es persistencia indebida de un rechazo.

**Error encontrado:** ninguno del frontend/API en estos casos. **Corrección:** ninguna de aplicación; se incorporó el arnés específico porque el validador histórico impedía enviar una descripción sin prefijo. No se volvió a ejecutar ese validador general.

## O2 · Aprobada en navegador real

Cuenta propia **1026**, creada desde Angular como `qa_b1_20261112091337.ui`, área **23**. La contraseña inicial fue introducida y enviada por el usuario directamente en el formulario; no se incluye en esta evidencia.

| Formulario/operación                           | Resultado observado                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alta con roles múltiples                       | Creación desde Angular; listado posterior muestra **PersonalArea + JefeArea**, área QA, Activo y Cambio requerido                                                                                                                                                                                                            |
| Edición                                        | Guardado desde Angular y listado posterior: `qa_b1_20261112091337.ui_edit`, nombre `QA_B1_20261112091337 UI EDITADO`, misma área QA                                                                                                                                                                                          |
| Asignación de roles                            | Formulario y confirmación reales: retirada de JefeArea, listado actualizado con **PersonalArea**; no se amplió alcance ajeno                                                                                                                                                                                                 |
| Desactivación                                  | Confirmación real, mensaje `Usuario desactivado correctamente`, fila Inactivo                                                                                                                                                                                                                                                |
| Reactivación                                   | Confirmación real, mensaje `Usuario activado correctamente`, fila Activo                                                                                                                                                                                                                                                     |
| Exigencia inicial                              | Login con la contraseña inicial dirige realmente a `/cambiar-password`, con `Debe establecer una nueva contraseña antes de continuar`                                                                                                                                                                                        |
| Restablecimiento administrativo                | El usuario introdujo y confirmó la contraseña temporal y envió el formulario/diálogo desde Angular. Retorno al listado con Cambio requerido; bitácora **799**, `RestablecimientoPassword`, `Exitoso`, **2026-11-12T09:23:57.0933107 UTC**                                                                                    |
| Cambio obligatorio completo y acceso posterior | El usuario ingresó con la contraseña temporal, completó y envió el cambio obligatorio desde Angular y volvió a iniciar sesión. Se observó realmente `/inicio`, nombre QA y perfil PersonalArea. Bitácora **801**, `CambioPassword`, `Exitoso`, **2026-11-12T09:27:18.5301928 UTC**. SQL confirma `DebeCambiarPassword=false` |

**Estado O2: aprobada realmente. Error encontrado:** ninguno funcional. **Corrección:** ninguna de aplicación. La política de control del navegador exigió intervención del usuario para la entrada, confirmación y envío de credenciales nuevas. El usuario completó esos pasos en Angular y confirmó su ejecución; se observaron el alta/retorno al listado, la pantalla inicial obligatoria y el acceso final a Inicio, y se corroboraron el restablecimiento/cambio mediante bitácora real y el indicador persistido. No se sustituyeron esos pasos por llamadas de preparación API.

Evidencia visual del acceso posterior, sin contraseñas ni JWT: [validacion-bloque-1-o2.jpg](validacion-bloque-1-o2.jpg). Al finalizar se cerraron localmente ambas sesiones de navegador utilizadas; no se presenta ese cierre como revocación del token.

## Cierre y verificaciones

Limpieza completada mediante API, comprobando la conexión efectiva antes de cada petición. El arnés terminó con código **0**. Una lectura SQL final confirmó: cuentas **1025/1026** inactivas, ambas con `DebeCambiarPassword=false`, y área **23** inactiva. Del actor financiero permanecen exactamente **1 registro y 1 historial**, con **0 modificaciones**. Se conservan registro de control, historial, bitácora y eventuales alertas automáticas de los eventos QA para trazabilidad. No se reactivaron fixtures históricos ni se gestionaron alertas ajenas.

**O2/O4/O7 cerradas.** Los demás casos del plan permanecen pendientes. No se ejecutaron O3, O6, detecciones manuales nuevas ni pruebas de otros bloques. Solo se añadieron este informe, la evidencia visual, el arnés dirigido y la actualización del plan, todos dentro de frontend.

No se modificó código de aplicación ni se encontraron errores que justifiquen repetir la suite aprobada. El arranque local generó correctamente el bundle de desarrollo; **no se declara como nueva compilación de producción**. Las 142 pruebas simuladas/32 archivos y build de producción del módulo 9 son evidencia histórica; no se ejecutaron nuevamente en este bloque. O4 es integración real API/SQL; O2 es navegador con API real; O7 es verificación real retrospectiva de evidencia conservada.
