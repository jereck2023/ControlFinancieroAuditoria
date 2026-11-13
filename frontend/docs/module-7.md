# Módulo 7 · Reportes financieros

Implementado el 11/11/2026 con Angular 22, TypeScript estricto, Bootstrap 5.3 y SCSS. Sin dependencias nuevas ni cambios de backend, migraciones o base principal.

## API y reglas revisadas

Se revisaron `ReportesFinancierosController`, `FiltroReporteFinancieroRequest`, `ResumenFinancieroResponse`, `GrupoResumenFinancieroResponse`, `DetalleFinancieroResponse`, `MovimientoDetalleFinancieroResponse` y la generación de archivos en `ExcelFinancieroService`.

| Endpoint GET bajo `/api/reportes-financieros` | Comportamiento                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/resumen`                                    | Cantidades, ingresos, egresos y diferencia de todo el filtro. Agrupación Ninguna, Area o Documento; grupos paginados. |
| `/detalle`                                    | Movimientos actuales, ordenados por fecha de operación e ID descendentes; paginación del servidor.                    |
| `/resumen/exportar`                           | Archivo del servidor con todos los grupos filtrados, independientemente de la página.                                 |
| `/detalle/exportar`                           | Archivo del servidor con todos los movimientos filtrados, hasta 10000 operaciones.                                    |

Los cuatro endpoints comparten el DTO. Exigen `fechaDesde` y `fechaHasta` DateOnly, incluidas ambas fechas, con inicio no posterior al final. Admiten `tipoOperacion` Ingreso/Egreso, `areaId` y `documentoFinancieroId` positivos opcionales, `soloSinDocumento`, `agrupacion`, `pagina` desde 1 y `tamanoPagina` de 1 a 100. Documento específico y solo sin documento son incompatibles. Un documento inexistente o ajeno al JefeArea devuelve 404; documento y área discordantes devuelven 400. Área ajena a JefeArea devuelve 403. El detalle valida también desbordamiento del desplazamiento de página.

Auditor tiene alcance global y puede filtrar por área. JefeArea necesita área activa y consulta solo la propia; su formulario no ofrece otra área. **Administrador + JefeArea sí está autorizado a reportes de su área**, a diferencia de historial/bitácora. Administrador solo, PersonalArea solo y su combinación sin JefeArea/Auditor no están autorizados. Auditor conserva alcance global en cualquier combinación. El servidor aplica estas reglas en cada consulta y exportación.

Las generaciones y exportaciones exitosas registran actividades en bitácora, aunque se invoquen mediante GET. El script manual comprueba antes de cada petición el proceso que escucha en 7202 y sus sesiones SQL; exige conexión exclusivamente a `ControlFinancieroDB_Pruebas`.

## Frontend

`features/financial-reports` separa requests, responses, modelos de presentación, servicio HTTP, página y componentes de filtros, indicadores, grupos y movimientos. Reutiliza `QueryState`, encabezados, mensajes, paginación, errores de campos y descarga segura de archivos. El filtro de área de Auditor obtiene opciones reales de `AreasApi.list()`, incluyendo áreas inactivas, con error y reintento del catálogo. La ruta diferida `/reportes-financieros`, el inicio y el menú usan el permiso específico `read-reports`, sin cambiar las reglas de trazabilidad. Se habilitó desplazamiento vertical del menú para mantener sus enlaces accesibles cuando aumentan las opciones.

La página espera una generación explícita. Los cambios del formulario no cambian el resultado previo: la exportación y la paginación usan los filtros aplicados. Generar nuevamente reinicia la página. El modo documento impide enviar filtros contradictorios. Las fechas de operación se envían como fechas de calendario, sin convertirlas a UTC ni sumar horas al fin del día.

El resumen presenta cantidades y totales de todo el período, aunque solo se muestre una página de grupos. La diferencia proviene del servidor y se identifica como ingresos menos egresos; no se presenta como saldo disponible ni presupuesto restante. La API no especifica moneda, por lo que no se asigna un símbolo monetario. Tablas de consulta sin celdas editables ni apariencia de hoja de cálculo.

Los importes se leen como lexemas decimales con `JSON.parse` reviver `context.source`; se preservan valores mayores al límite individual, cero y diferencias negativas como -0.25. La presentación no usa sumas ni conversiones monetarias a `Number`. Se requiere el mismo soporte de navegador moderno documentado en los módulos anteriores. Datos y errores se muestran por interpolación segura.

## Verificación

La suite automatizada ampliada ejecutó **112 pruebas aprobadas en 26 archivos**. Incluye las 16 combinaciones de roles, contratos GET y exportación, validación de fechas/identificadores, documentos excluyentes, catálogo de áreas con error/reintento e inclusión de inactivas, agrupación solo en resumen, precisión decimal, paginación y reinicio al filtrar, texto seguro, resultados vacíos, limpieza ante 403 y recuperación del error simulado de límite de exportación. Las pruebas HTTP automatizadas utilizan `HttpTestingController`: son simuladas y no acreditan integración real.

`npm.cmd run build`: **compilación final de producción exitosa**, carga inicial de 520,51 kB y módulo diferido de aproximadamente 22,77 kB. Compilar no acredita funcionamiento real de la API.

## Integración real

`scripts/validate-module-7.mjs --ui` terminó con **207 comprobaciones aprobadas**, incluyendo preparación y desactivación de datos propios. Se confirmó la conexión exclusiva a `ControlFinancieroDB_Pruebas` antes de cada petición, porque hasta un GET de reportes puede escribir bitácora. La API fue iniciada por el usuario con su configuración de pruebas; el frontend no inició ni modificó el backend.

Se verificaron resumen y detalle, fechas inclusivas, operación, área, documento y solo sin documento, agrupaciones Area/Documento, páginas distintas del servidor, totales independientes de la página y resultados vacíos. Un documento QA con ingreso 2.50 y egreso 2.75 dio diferencia -0.25. El área QA dio ingresos 10000000000000012.74, egresos 6.85 y diferencia 10000000000000005.89, sin redondeo en JSON ni en pantalla.

Se probaron los cuatro endpoints con parámetros inválidos 400, documentos inexistentes 404, incompatibilidad de documento/área y ausencia de JWT 401. Las 15 combinaciones no vacías de los cuatro roles devolvieron los permisos esperados para consulta y exportación: JefeArea restringido al área propia y Auditor con acceso a ambas áreas QA. Se comprobó también JefeArea con área inactiva (403) y Auditor con área inactiva (acceso permitido). Los archivos se inspeccionaron como ZIP/XML en memoria: resumen con los dos grupos y detalle con los cinco movimientos propios, aunque se solicitara una fila por página. También se exportaron reportes vacíos.

En navegador se comprobaron generación de ambos reportes, diferencia negativa, importes extensos, agrupación por documento, consulta global con página 2, reinicio a página 1 al cambiar filtros, estados vacíos de ambos reportes, rechazo del intervalo invertido, catálogo real de áreas después de la corrección, recepción de ambas descargas y denegación de la ruta al Administrador exclusivo. El cambio de roles de la cuenta durante la matriz invalidó su sesión de navegador: el frontend trató el 401 cerrando sesión; la descarga pendiente se repitió con una sesión vigente y se recibió. La revisión móvil a 390 px confirmó documento sin desbordamiento horizontal e importes largos en una sola línea.

No se repitió la aceptación real completa de los módulos anteriores. Se ejecutó la suite automatizada completa por los cambios de permisos y navegación compartidos.

## Errores observados, mitigaciones y límites pendientes

- **Área inexistente:** una consulta real con ID de área positivo inexistente devolvió error del servidor; el controlador intenta registrar bitácora con ese ID. Se sustituyó la entrada numérica por selección de áreas reales y se validó la pertenencia al catálogo antes de enviar. La corrección se probó contra la API. El backend conserva esa limitación para peticiones directas con IDs inexistentes; no se modificó.
- **Precisión del Excel del servidor:** `scripts/inspect-report-export.mjs 18` comprobó en memoria que un monto exacto de API `9999999999999999.99` aparece como `1E+16` en la celda numérica del archivo exportado. La inspección exitosa acredita la limitación, no la exactitud de ese importe en Excel. Se informa junto a la exportación; la pantalla preserva el decimal exacto. La descarga utiliza el archivo original de la API, sin reconstruirlo ni modificarlo. Resolver la precisión del archivo requiere tratar la generación del servidor en otro alcance.
- Se ajustó la presentación de indicadores extensos para no partir cifras entre líneas; se verificó en escritorio y móvil. Las tablas mantienen desplazamiento horizontal dentro de su contenedor.
- No se generaron más de 10000 operaciones para forzar el límite de exportación: ese caso tiene cobertura simulada y revisión del controlador, **no una prueba real del umbral**. Tampoco se realizaron pruebas de carga masiva ni una matriz exhaustiva de navegadores.

Las credenciales y JWT se recibieron por entrada oculta y permanecieron en memoria; no se guardaron en scripts, archivos, capturas ni registros. Los archivos Excel de las comprobaciones por script solo se procesaron en memoria. Para repetir, ejecutar `node scripts/validate-module-7.mjs --ui`, introducir las dos credenciales ocultas solicitadas y pulsar Enter tras terminar el navegador. El inspector adicional requiere usuario QA y contraseña por entrada oculta y un ID de área QA como argumento; debe ejecutarse antes de desactivar esa cuenta.

Ejecución `QA_M7_20261111222808`: áreas 18/19, cuentas 1018/1019, registros 10035–10040 y documento 11. Las cuentas y áreas propias quedaron desactivadas mediante la API. Los registros, documento y trazabilidad permanecen identificados en la base de pruebas; no existe eliminación en este alcance. No se alteraron usuarios, áreas ni registros ajenos a esta ejecución.
