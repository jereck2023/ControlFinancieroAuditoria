# Ajustes de Alertas, fechas y menú lateral

17/11/2026, hora de Perú.

## Cambios realizados

- El detalle de Gestión de alertas ahora abre `InformationDialog`, el mismo modal institucional del historial. Ya no existe el panel inferior. Se mantienen Actualizar detalle, datos del evento, regla, usuarios, registro, revisión, cierre, justificación, mensajes, errores y enlaces de trazabilidad.
- Se conservan las acciones y sus confirmaciones existentes: Pendiente → iniciar revisión; En revisión → Resuelta/Descartada con justificación. Se mantienen RowVersion, recuperación ante 409/respuesta incierta y prohibición de reenvío automático. No se cambiaron los métodos de negocio de `AlertsPage`, servicios HTTP ni permisos.
- La dependencia compartida del modal recibió un indicador opcional de operación en curso (por defecto falso) y una separación de eventos de teclado/cancelación para no interferir con la confirmación anidada. Los modales anteriores conservan su comportamiento; se ejecutaron sus pruebas de regresión.
- Se eliminó «Ver evidencias completas» y su representación cruda. Se muestran únicamente las referencias conocidas del historial y bitácora, con etiquetas en español y sus identificadores. Las formas desconocidas o inválidas se omiten con un mensaje comprensible. Los enlaces existentes se conservan según los permisos actuales. Los nombres de campos financieros conocidos también se presentan con etiquetas legibles.
- Evento, detección, inicio de revisión y cierre se presentan en hora de Perú mediante el formateador ya existente. Los valores originales del contrato no se modifican. Los filtros indican hora de Perú y convierten sus límites a UTC al consultar, con inclusión del segundo final.
- Menú: Inicio → Documentos → Registros → Reportes → Historial → Bitácora → Alertas → Áreas → Gestión de usuarios → Usuarios de mi área, según permisos. Se mantiene el acceso previo Importar Excel junto a Registros, solo para PersonalArea. No se agrega la detección manual oculta ni se modifica ninguna ruta.
- Para Administrador + JefeArea se conserva la prioridad previa del menú global de usuarios; su consulta propia sigue autorizada por la ruta existente, como antes. No se introdujeron restricciones nuevas a combinaciones de roles.
- Sin cambios de estilos SCSS globales, colores, tipografía, librerías, backend, estados, reglas, entidades ni migraciones.

## Archivos de esta intervención

Dentro de `frontend/src/app`:

- `features/alerts/pages/alerts-page.ts`, `.html` y `.spec.ts`.
- `features/alerts/components/alert-detail.ts`, `.html` y `.spec.ts`.
- `features/alerts/components/alert-filters.ts`, `.html` y nuevo `.spec.ts`.
- `features/alerts/models/alert-view.ts` y `.spec.ts`.
- `shared/ui/information-dialog.ts` y `.spec.ts`.
- `layout/app-shell.html` y nuevo `app-shell.spec.ts`.

Documentación: este informe. Los demás cambios pendientes de Git proceden de intervenciones anteriores.

## Pruebas automatizadas

**45 pruebas aprobadas en 10 archivos.** HTTP simulado con Angular HttpTestingController; no son acciones reales contra el backend.

- Apertura y cierre del detalle mediante botón y cancelación/Escape; conservación de las instancias del listado/filtros y ausencia de nuevas peticiones al cerrar.
- Ausencia de panel inferior, `pre`, `details` y visor de evidencia cruda. Referencias y enlaces de historial/bitácora presentes; contenido desconocido omitido, justificación representada como texto seguro.
- Confirmación anidada: cancelarla conserva el detalle abierto y no envía escrituras. El modal exterior no consume sus eventos de cancelación o Tab.
- Inicio de revisión y cierres Resuelta/Descartada: solicitud con versión correcta, justificación, bloqueo del cierre exterior mientras la operación está en curso, recarga posterior del detalle/lista.
- Conflictos 409, fallo de recuperación, respuesta incierta, justificación mínima, alerta cerrada sin reapertura y ajuste de última página: pruebas anteriores de Alertas conservadas y aprobadas.
- Fechas del ejemplo SQL 142 en tabla/detalle y límites del filtro de Perú convertidos a UTC.
- Orden exacto de enlaces y permisos en cuatro roles individuales y cuatro combinaciones: Admin+Auditor, Admin+Jefe, Jefe+Auditor y Personal+Jefe+Auditor.
- Regresión de los modales de Historial/Bitácora y del formateador de Perú.

Se actualizó una expectativa antigua que exigía mostrar evidencia cruda; el primer intento de suite falló por esa aserción obsoleta, no por la nueva presentación. La ejecución final de las 45 pruebas pasó.

Compilación de producción Angular aprobada, paquete inicial **523,11 kB**. Comprobación TypeScript de imports/parámetros no utilizados aprobada. No se recompiló el backend porque no cambió; no se repitió toda la suite del proyecto.

## Lectura SQL real

Se ejecutaron únicamente `SELECT`, con conexión explícita a **ControlFinancieroDB_Pruebas** y comprobación de `DB_NAME()`.

| Alerta QA 142 | Valor UTC leído | Presentación Perú comprobada en test |
| --- | --- | --- |
| Evento | 11/11/2026 23:24:42.2181236 | 11/11/2026 18:24:42 |
| Detección | 11/11/2026 23:25:11.2653559 | 11/11/2026 18:25:11 |
| Inicio de revisión | 12/11/2026 10:02:43.6923641 | 12/11/2026 05:02:43 |
| Cierre | 12/11/2026 11:03:58.1880121 | 12/11/2026 06:03:58 |

La evidencia real de esa alerta referencia la actividad 705. La alerta 3257 conserva el evento UTC 15/11/2026 05:50:20.4102561 y los historiales 11094–11096. El código del backend confirma UTC en detección, revisión y cierre. No se alteraron esas marcas ni se enviaron cambios de estado.

La lectura real de SQL y la representación con esos datos mediante HTTP simulado son comprobaciones distintas; no se declara una ejecución real de revisión/cierre ni una nueva integración autenticada con la API.

## Alcance acordado de verificación

El usuario indicó expresamente que no tenía sesión y que se validara solo con SQL de lectura y pruebas automatizadas. Por ello:

- No se inició sesión, no se activaron cuentas/áreas, no se inició una API separada ni se realizaron escrituras en la base.
- No hubo comprobación visual en navegador autenticado ni medición nueva del desplazamiento o del foco nativo: JSDOM no reproduce esa geometría. Se reutiliza el patrón institucional ya verificado; los nuevos controles y confirmaciones se comprobaron automatizadamente.
- No se ejecutaron acciones reales de revisión/cierre, para respetar la prohibición de modificar la base.
- Evidencia local ignorada por Git: `docs/evidencias-ajustes-alertas-menu-20261117/verificacion.json`.
- Sin commits ni push. No se detectaron errores funcionales adicionales en el alcance probado; la comprobación visual autenticada queda como complemento no ejecutado.
