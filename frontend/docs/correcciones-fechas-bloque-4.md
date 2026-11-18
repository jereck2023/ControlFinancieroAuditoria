# Bloque 4: fechas de auditoría y ocultación de la detección manual

Validación del 15/11/2026, hora de Perú. Ejecución `QA_TIME_B4_20261115054933`.

## Diagnóstico comprobado

No se encontró un desplazamiento de un día en los datos almacenados. La diferencia observada correspondía a **presentar UTC en lugar de hora de Perú**:

- `RegistrosFinancierosController` asigna `DateTime.UtcNow` al crear/modificar; la importación usa también una marca UTC. `BitacoraActividadService.PrepararRegistro` asigna UTC a las actividades.
- Las columnas existentes son `datetime2`, sin zona horaria. Los controladores de consulta devuelven esos valores sin conversión. Al materializarse desde SQL, las respuestas observadas no incluyen sufijo `Z`.
- El formateador anterior normalizaba correctamente esas marcas como UTC, pero las **mostraba en UTC**. Los encabezados y los filtros también indicaban UTC. No era una corrupción de todos los eventos ni un día agregado por el backend.
- Caso real: historial 11079, SQL/API `2026-11-15T04:53:32.8368063`, corresponde a **14/11/2026 23:53:32 en Perú**. Bitácora 3952: UTC `2026-11-15T04:53:18.8172133`, corresponde a **14/11/2026 23:53:18**.

## Corrección mínima y dependencias

- Nuevo `PeruTimestamp`: interpreta los eventos sin sufijo como UTC y los muestra en UTC−05:00, independiente de la zona del navegador. Se utiliza únicamente en Historial y Bitácora, tanto en tablas como en los modales aprobados del Bloque 3.
- Los filtros de ambos módulos ahora indican «Desde (Perú)» / «Hasta (Perú)». Convierten el horario introducido a límites UTC antes de consultar. Por ejemplo, el día local 14/11 abarca `14/11 05:00:00.0000000Z` hasta `15/11 04:59:59.9999999Z`. Se mantiene inclusivo el segundo final.
- Se añadió validación del calendario y del rango representable por el servidor. No se suma ni resta un día artificialmente ni se modifica ninguna fecha histórica.
- **Dependencia detectada:** Alertas usa el mismo formateador y funciones UTC originales. Esos contratos se conservaron: Alertas sigue mostrando y filtrando UTC con sus etiquetas existentes. Solo `baseTraceQuery`, usado por Historial y Bitácora, convierte desde Perú; los filtros de Alertas llaman directamente al convertidor UTC anterior.
- La interfaz manual se deshabilitó temporalmente mediante el permiso de interfaz `detect-anomalies` en `AccessPolicy`. El menú lateral, la tarjeta de Inicio y el guard de la ruta ya consumían ese permiso, por lo que quedan ocultos/bloqueados de forma coherente, para cualquier combinación de roles.
- Se conservan la ruta protegida, página, servicios, componentes y endpoint manual. Su texto técnico no se muestra porque la página no puede activarse. No se cambió ninguna autorización del backend ni el permiso de Gestión de alertas.
- El servicio de detección, su registro en `Program.cs` y el proceso periódico de un minuto permanecen sin cambios. Tampoco se modificaron reglas, parámetros, entidades, contexto, migraciones, SCSS ni configuraciones de producción.

## Archivos de este bloque

En `frontend/src/app`:

- Nuevos `shared/traceability/peru-timestamp.ts` y `.spec.ts`.
- `shared/traceability/trace-query.ts`, `.spec.ts`, `trace-filters.ts` y `.html`.
- `shared/forms/field-error.ts`: mensaje de validación de fechas de Perú.
- `features/audit-history/pages/history-page.ts` y `.html`.
- `features/activity-log/pages/activity-page.ts` y `.html`.
- `core/auth/access-policy.ts`, `.spec.ts` y `auth-guards.spec.ts`: deshabilitación de la interfaz manual y comprobaciones de ruta/Alertas.

Soporte: `frontend/scripts/validate-dates-block-4.mjs` y este informe. Los demás cambios pendientes en Git pertenecen a bloques anteriores y no fueron rehechos.

## Compilaciones y pruebas automatizadas

- Backend Release: aprobado, cero errores y cero advertencias. Sin cambios de código del backend en este bloque.
- Angular producción: aprobado; paquete inicial 523,11 kB.
- Suite completa: **166 pruebas aprobadas en 36 archivos**. Incluye nuevas pruebas de medianoche, cambio de año, marcas con/sin zona, calendario, segundo final, límites UTC equivalentes para ambos módulos y bloqueo manual para Auditor y combinaciones con Administrador/JefeArea. Las pruebas UTC de Alertas siguen pasando.
- TypeScript con detección de imports/parámetros no utilizados: aprobado.
- Se conservaron las pruebas previas de modales, permisos administrativos y registros/exportaciones. No se repitieron matrices funcionales integrales ni O1–O10.

## Pruebas reales de fechas, SQL y navegador

Se usó una API separada en HTTPS 7296 con configuración exclusivamente en memoria para `ControlFinancieroDB_Pruebas`. Se comprobó la base efectiva y el nombre de aplicación de las sesiones SQL de su PID antes de las peticiones y escrituras. No se accedió a los datos de la base principal ni se ejecutaron migraciones.

Se compararon con SQL los límites de día local para el usuario QA 3035:

| Consulta real | Día local 14/11/2026 | Día local 15/11/2026 |
| --- | --- | --- |
| Historial | 12 eventos | 4 eventos |
| Bitácora | 23 actividades | 4 actividades |

Las cuatro respuestas HTTP 200 coincidieron con los conteos SQL y ningún evento devuelto quedó fuera del intervalo solicitado. También se contrastaron individualmente las marcas SQL/API del historial 11079 y actividad 3952.

En Angular real, mediante relé local 4309 hacia Angular 4200/API 7296:

- Auditor visualizó los eventos anteriores a medianoche como 14/11 a las 23:53 y los nuevos como 15/11 a las 00:50. Se comprobaron fechas en listado y modal de ambos módulos.
- Bitácora con ambos límites locales devolvió 23 actividades del día 14 y 4 del día 15. En Historial, Auditor consultó el día 15 con ambos límites, y JefeArea el día 14 con ambos límites y el documento QA 2014: 12 eventos de su área, a las 23:53:32.
- La primera consulta visual de Auditor para el día 14 envió solo «Hasta»: el control del navegador normalizó los segundos cero al rellenar «Desde», pero interrumpió esa acción antes de notificar el valor al formulario. Se distinguió ese intento de las consultas posteriores con ambos límites, que usaron el formato normalizado por el navegador. No se atribuyó esta incidencia a CFA.
- No hubo acceso manual en menú ni tarjeta de Inicio, ni texto técnico visible. Escribir `/deteccion-anomalias` con Auditor terminó en `/acceso-denegado`, sin botón de ejecución.
- Gestión de alertas cargó su tabla sin errores para Auditor y JefeArea. No se inició revisión ni se cerraron alertas durante este bloque.
- El relé registró 14 respuestas HTTP 200 del recorrido. No registró ni permitió peticiones al endpoint de detección manual.

## Verificación de la detección automática y las tres reglas

Se reutilizaron el área QA 2025 y las cuentas QA existentes 3035–3037. Se creó **un registro QA independiente, 21063**, y se hicieron tres modificaciones de su descripción mediante la API y RowVersion. Los documentos originales, incluido el 2014, no se modificaron.

Para los cinco accesos fallidos se creó únicamente la cuenta temporal QA 3045, evitando bloquear cuentas existentes. Se mantuvo el bloqueo normal de Identity, sin cambiar contraseñas, parámetros ni relojes. Todas las marcas de los eventos fueron asignadas por el backend en el momento real.

El proceso periódico de la instancia aislada (PID 22348) registró **10 alertas nuevas** en su primera evaluación del conjunto preparado. Ese contador no se usó como evidencia suficiente: se identificaron estas cinco alertas QA concretas en SQL:

| Regla | Evidencia real |
| --- | --- |
| MODIFICACION_REITERADA | Alerta 3257, registro 21063, campo Descripcion; historiales 11094, 11095 y 11096 |
| FUERA_DE_HORARIO | Alertas 3258–3260, registro 21063; cada una referencia respectivamente los historiales 11094–11096, ocurridos a las 00:50 de Perú |
| LOGIN_FALLIDO_REITERADO | Alerta 3266, cuenta QA 3045; actividades 4095–4099, todas con resultado Fallido y detalle «Contraseña incorrecta.» |

Las alertas restantes del contador corresponden a accesos fuera de horario registrados normalmente durante la preparación. No se confundieron con evidencia de una modificación financiera.

Parámetros comprobados antes y después, sin cambios: modificaciones reiteradas **3/30 minutos**, horario **08:00–18:00 de lunes a viernes**, accesos fallidos **5/15 minutos**, las tres reglas activas. Solo avanzó su marca normal de última evaluación. No se invocó `DetectarAsync` directamente ni el endpoint manual; las alertas fueron generadas por el proceso periódico existente.

## Incidencia del arnés y estado final

- El primer sondeo SQL sin alertas devolvió texto vacío y el lector lo trató como JSON. Se detuvo el arnés y su proceso aislado. Se corrigió únicamente el lector para aceptar ese resultado como una lista vacía y se reanudó con los mismos datos, sin recrear cuentas/registros ni repetir modificaciones o intentos fallidos. La evidencia conserva el fallo y la recuperación.
- Al finalizar, los tres usuarios reutilizados y el área regresaron a su estado inactivo original; la cuenta temporal 3045 quedó inactiva. Se comprobó por SQL. Se conservaron el registro, sus cuatro eventos de historial, las actividades y alertas como trazabilidad.
- Las comprobaciones de integridad de los eventos históricos y de los registros financieros ajenos a la preparación pasaron durante preparación/reanudación y cierre. No hubo operaciones de modificación de eventos históricos.
- La API aislada y el relé fueron detenidos. El arnés completó 34 comprobaciones HTTP, incluidas preparación, recuperación y restitución.
- Evidencias locales excluidas de Git: `frontend/docs/evidencias-fechas-bloque-4/QA_TIME_B4_20261115054933/resultado.json`, `angular-comprobaciones.json` y `historial-hora-peru.png`. Sin contraseñas ni JWT.

## Límites conocidos

- Los eventos reales cercanos al cambio de día comprobados fueron de las 23:53–23:56 y de las 00:50 de Perú. El instante exacto 23:59:59/00:00:00, la precisión completa del segundo final y el cambio de año se probaron automáticamente; no se fabricaron eventos históricos ni se alteraron sus fechas para obtener esos instantes.
- La verificación visual se realizó en el navegador integrado. No se repitió la matriz de navegadores ni una prueba de carga.
- Gestión de alertas conserva intencionalmente sus fechas UTC y etiquetas previas. La conversión a Perú de este bloque está acotada a Historial y Bitácora.
- Sin defectos funcionales adicionales pendientes identificados en el alcance comprobado. Sin commits, push ni modificaciones adicionales.
