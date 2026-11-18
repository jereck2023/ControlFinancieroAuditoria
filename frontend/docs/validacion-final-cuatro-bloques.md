# Validación conjunta final de los cuatro bloques

Fecha: 15/11/2026, Perú. Ejecución `QA_FINAL_20261115064337`.

**Estado actualizado:** el error de presentación de Documentos se corrigió y verificó por autorización posterior; queda pendiente la apertura manual de los tres Excel. Véase [la corrección de fecha de importación](correccion-fecha-importacion-documentos.md): 23 pruebas relevantes aprobadas y comprobación real del documento 2014. No se repitió la suite completa ni se autorizaron commits/push.

**Resultado original de la validación conjunta:** comprobaciones aprobadas con dos observaciones, la fecha de Documentos y la revisión manual de Excel. El resto de este informe conserva las evidencias y el diagnóstico originales; durante aquella validación no se aplicaron correcciones funcionales.

## Compilación y pruebas automatizadas

- Backend Release: correcto, cero errores y cero advertencias.
- Angular producción: correcto, paquete inicial 523,11 kB.
- Suite completa: **166 pruebas aprobadas en 36 archivos**. Incluye HTTP simulado y pruebas puras de políticas, formularios, contratos y fechas; no equivale a 166 pruebas contra la API.
- TypeScript con detección de imports/parámetros no utilizados: aprobado.
- Se reutilizaron las compilaciones y resultados ya obtenidos en esta misma ejecución al retomar tras la interrupción. No se volvieron a ejecutar ni se repitieron O1–O10, importaciones masivas o matrices exhaustivas de navegadores.

## Comprobaciones reales aprobadas

API compilada aislada en HTTPS 7297, PID 1864, conectada exclusivamente a `ControlFinancieroDB_Pruebas`, verificada mediante las sesiones SQL del proceso antes de las peticiones/escrituras. Angular se consultó mediante un relé local 4310 hacia Angular 4200 y esa API; no se modificó su configuración habitual.

El arnés completó **139 respuestas HTTP con el estado esperado**, incluidas preparación/restitución, **16 exportaciones permitidas** y **nueve perfiles de roles**. No son 139 escenarios independientes. El recorrido de Angular registró otras 36 respuestas HTTP; el contraste adicional del documento utilizó login y consulta reales independientes.

| Ámbito | Evidencia de esta validación |
| --- | --- |
| Áreas y usuarios | Administrador/Auditor consultan áreas; PersonalArea/JefeArea solos reciben 403. Solo Administrador accede a usuarios globales; los demás no pueden modificar áreas ni asignar roles. Activación/desactivación administrativa QA real durante preparación/restitución. |
| Consulta propia | JefeArea y sus combinaciones obtienen exactamente las diez cuentas SQL de su área, con cinco campos permitidos; forzar `areaId=2026&id=3044` no amplía el alcance. |
| Combinaciones | PersonalArea, JefeArea, Auditor, Administrador, Admin+Personal, Admin+Jefe, Admin+Auditor, Personal+Jefe y Jefe+Auditor. Permisos y prioridad de exportación correctos. |
| Exportaciones | Ambas modalidades: 4/6/7 columnas exactas; Administrador solo recibe 403. Documento QA 2014: 12 filas. Exportación general: 13 filas para alcance local y 10 062 para Auditor. Fecha y monto originales comprobados estructuralmente. |
| ID exacto | ID 21049 propio, 21061 ajeno, 2147483647 inexistente y prefijo 2104. Igualdad exacta y alcance correctos. |
| Auditoría/Bitácora | JefeArea no obtiene eventos del documento ajeno 2015; Auditor sí. Límites UTC correspondientes a los días 14 y 15 de Perú coinciden con los conteos SQL. |
| Reportes | Consultas ordinarias de resumen y detalle del documento QA, con Auditor/JefeArea, HTTP 200. Texto visible solicitado, sin referencia a la API. |
| Alertas | Consulta real permitida a Auditor/JefeArea y denegada a los roles individuales Administrador/PersonalArea. No se repitieron cierres ni concurrencia ya aprobados; no se alteraron estados de alertas. |
| Detección automática | Se conservan las alertas QA 3257–3260 y 3266 y sus evidencias para las tres reglas del Bloque 4. En esta ejecución el proceso periódico generó la alerta nueva 3271, vinculada al acceso QA 4112, sin invocar la detección manual. Esta alerta de acceso no sustituye las evidencias financieras conservadas. Parámetros de las tres reglas sin cambios. |

### Angular real y presentación

- Se verificaron menú y rutas de seis perfiles: PersonalArea, Auditor, Administrador, Admin+Jefe, Jefe+Auditor y JefeArea. Directorio, administración global y consulta propia coincidieron con sus permisos; las cuentas propias no expusieron acciones administrativas ni al usuario ajeno.
- Registros: búsqueda desde página 2 de 13 resultados, ID 21049 y filtros de descripción/operación/área/fechas → una fila. Operación incompatible → cero. Limpiar solo ID conservó los filtros y devolvió seis ingresos.
- Historial: documento 2014, día local 14, página 2. Abrir con Enter y cerrar con Escape mantuvo filtros, filas y desplazamiento **161 → 161 → 161**. Sin panel inferior ni visor crudo.
- Modificación real 11096, registro 21063: descripción anterior/nueva legible y fecha local **15/11/2026 00:50:20**. Eventos previos a medianoche: **14/11/2026 23:53:32**.
- Bitácora: documento 2014, día local 14, página 2. Apertura y cierre visible conservaron filtros, filas y desplazamiento **423 → 423 → 423**. Sin panel inferior ni JSON crudo.
- Auditor no ve enlaces/botón/texto técnico de detección manual; su URL directa redirige a acceso restringido. Gestión de alertas cargó correctamente para Auditor y JefeArea.
- La tabla compartida de Documentos mantiene sus 12 registros y no incorpora el filtro ID de la pantalla general. Diseño institucional y navegación conservados. Se reutilizó la revisión móvil del Bloque 3; no se presenta como una nueva matriz de dispositivos.
- Un intento de automatización leyó el listado antes de aplicar la consulta modificada. No se contó como aprobado: se aplicó nuevamente y se verificaron los tres eventos y el modal correctos.

## Hallazgo de fecha de importación de Documentos: diagnóstico original, ya corregido

**Error de presentación confirmado en detalle y listado del documento QA 2014.**

| Origen | Valor real |
| --- | --- |
| SQL `FechaImportacion` | `2026-11-15T04:53:32.7419396`, UTC |
| API `fechaImportacion` | `2026-11-15T04:53:32.7419396`, sin sufijo de zona |
| Hora equivalente en Perú, comprobada con SQL `AT TIME ZONE` | `2026-11-14T23:53:32.7419396` |
| Detalle y listado de Angular | `15/11/2026 09:53`, etiquetado UTC: incorrecto |

`DocumentsApi` entrega la marca sin normalizar y ambas plantillas aplican `DatePipe` directamente con zona de salida UTC. Una entrada sin zona se interpreta como hora local del navegador antes de convertirla; aquí agrega cinco horas. No es corrupción en SQL ni el cambio de Historial/Bitácora: Documentos conserva su formateo anterior y no comparte el nuevo pipe de Perú.

**Propuesta original, antes de aprobar la corrección:** normalizar únicamente `fechaImportacion` como UTC en las respuestas tipadas de `DocumentsApi.list()` y `.get()` cuando no traiga zona explícita, conservando el formato visual. Posteriormente el usuario aprobó expresamente mostrar la hora de Perú y cambiar las etiquetas. Esa corrección se aplicó y verificó sin modificar fechas almacenadas, backend ni zona del sistema; el resultado actual es `14/11/2026 23:53` en ambas vistas. El informe específico documenta sus pruebas y archivos.

El diagnóstico SQL inicial con estilo 127 serializó nuevamente el offset como UTC; se corrigió solo el lector de diagnóstico y se contrastó la hora local mediante `CAST(... AT TIME ZONE ... AS datetime2)`. No se usó ese resultado inicial como evidencia de la hora de Perú ni se modificó código funcional.

## Excel para revisión manual

Carpeta exacta: `C:\Proyectos\CFA\frontend\docs\evidencias-validacion-final\Excel-para-revision-manual`.

1. `01-personal-area-4-columnas.xlsx`
2. `02-jefe-area-6-columnas.xlsx`
3. `03-auditor-7-columnas.xlsx`

Son descargas reales del documento 2014, realizadas con cada rol; cada archivo contiene 12 operaciones con fecha 14/11/2026. Para los formatos con identificador: IDs 21049–21060. Sus encabezados exactos son los aprobados para cada rol, en el orden acordado.

**Apertura en Microsoft Excel pendiente.** Solo se comprobó el contenido estructural y la descarga. No se afirma apertura sin reparación ni visualización en Excel. Los archivos se conservan localmente, excluidos de Git; no es necesario volver a exportarlos para la revisión manual.

## Integridad y restitución

- No se crearon ni modificaron registros financieros, documentos o historiales financieros durante esta validación final. Se reutilizaron las cuentas y datos QA existentes.
- Huella de todos los registros financieros, incluidos sus RowVersion: antes/después `4A9C305026030711E38E967644CB16AEE9ACD94177D5B58C55216B7408733FFA`.
- Huella de todos los eventos de historial financiero: antes/después `4792982F5A53610A5363F529A9723609C1149C263C4BD7E5D9FB115033753253`.
- Las nueve cuentas 3035–3043 y el área 2025 regresaron al estado inactivo original, comprobado por SQL. Los roles no se cambiaron. Solo se añadieron las actividades y alertas normales asociadas a accesos y preparación.
- API aislada y relé detenidos. No se realizaron operaciones sobre la base principal, entidades, contexto ni migraciones.

## Git y archivos locales

Repositorio `C:\Proyectos\CFA`, rama `main`, sin archivos en staging. No se hicieron commits ni push.

36 archivos rastreados modificados y 26 nuevos no rastreados (8 del backend y 54 del frontend/configuración).

- Backend pendiente de los bloques: cuatro controladores/servicio modificados (`AreasController`, `DocumentosFinancierosController`, `RegistrosFinancierosController`, `ExcelFinancieroService`) y cuatro archivos nuevos (`UsuariosAreaController`, `FiltroRegistrosFinancierosRequest`, `UsuarioAreaResponse`, `PerfilExportacionFinanciera`). Ningún cambio nuevo del backend en esta validación.
- Frontend: código, contratos, estilos de modal y tests de los cuatro bloques, documentación y arneses. En esta validación solo se añadieron el arnés conjunto, este informe y la exclusión Git del diagnóstico puntual; sin modificaciones funcionales del producto.
- Deben permanecer locales/ignorados: `node_modules`, `dist`, `bin/obj`, cachés, coberturas, respaldos, registros, XLSX/capturas/JSON QA de `docs/evidencias-*` y el diagnóstico puntual `scripts/inspect-document-timestamp.mjs`, ligado al PID local. No se eliminó ningún archivo.
- Revisión de los archivos propuestos: sin contraseñas conocidas, JWT literales, claves privadas ni contraseñas de conexión detectadas. No hay artefactos compilados rastreados. Esto documenta la revisión realizada, no una garantía universal de ausencia de secretos. El inventario detallado queda en `docs/evidencias-validacion-final/git-revision.json`, excluido de Git.

Evidencias principales: `docs/evidencias-validacion-final/QA_FINAL_20261115064337/resultado.json`, `angular-comprobaciones.json`, `documento-2014-fecha.json` y capturas. El resultado positivo del arnés se refiere a sus comprobaciones de API; **no elimina las observaciones de Documentos ni la revisión manual pendiente de Excel**.
