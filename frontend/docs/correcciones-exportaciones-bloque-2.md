# Bloque 2: exportaciones Excel y búsqueda exacta por ID

Validado el 14/11/2026 (Perú), ejecución `QA_EXP_B2_20261115045253`.

## Cambios y dependencias

Archivos de este bloque (los cambios previos del Bloque 1 permanecen separados y sin rehacer):

- Backend: `Controllers/DocumentosFinancierosController.cs`, `Controllers/RegistrosFinancierosController.cs`, `Services/ExcelFinancieroService.cs`, nuevo `Services/PerfilExportacionFinanciera.cs` y nuevo `DTOs/FiltroRegistrosFinancierosRequest.cs`.
- Angular, dentro de `features/financial-records`: `components/records-table.ts` y `.html`; `pages/records-list.ts`, `.html` y nuevo `.spec.ts`; `data-access/records-api.ts` y `.spec.ts`; nuevo `models/requests/record-query.ts`.
- Soporte: nuevo `scripts/validate-exports-block-2.mjs` y este informe. No se agregaron dependencias.

- Ambos endpoints existentes de exportación (`documentos-financieros/{id}/exportar` y `registros-financieros/exportar`) comparten el generador de Excel. Ahora reciben un perfil resuelto en el servidor con prioridad Auditor > JefeArea > PersonalArea. Administrador no agrega permiso financiero.
- PersonalArea exporta exactamente `TipoOperacion, Descripcion, FechaOperacion, Monto`; JefeArea agrega `RegistroFinancieroId` al inicio y `UsuarioCreador` al final; Auditor agrega además `Area`, antes de `UsuarioCreador`. No se ocultan columnas: las no autorizadas no se generan.
- Se conservan las restricciones previas de área activa y alcance global del Auditor. No se cambiaron los valores, identificadores, respuestas financieras ni RowVersion almacenados.
- El listado admite el contrato opcional `registroFinancieroId`, validado como entero positivo Int32. La igualdad se aplica en la consulta del servidor después de restringir el área. Una consulta sin ese parámetro conserva el comportamiento anterior.
- Angular incorpora «Buscar por ID» y «Limpiar ID» en la tabla reutilizable, habilitados únicamente en la pantalla general de Registros. La búsqueda conserva los demás filtros y vuelve a la primera página. El detalle del documento utiliza la misma tabla sin incorporar este filtro.
- La paginación y los demás filtros siguen siendo locales, como antes. Exportar todo el alcance sigue exportando el conjunto autorizado completo, independiente de los filtros de pantalla; el texto visible lo explica.
- Los generadores de Resumen Financiero y Detalle Financiero no fueron modificados. Tampoco se modificó la implementación aprobada del Bloque 1.

## Pruebas automatizadas y compilaciones

- Backend Release: compilación correcta, sin advertencias ni errores.
- Angular producción: compilación correcta; paquete inicial 523,13 kB.
- Suite completa del frontend: **153 pruebas aprobadas en 34 archivos**. Incluye tres pruebas nuevas: contrato HTTP del ID; búsqueda, paginación y conservación de filtros; ausencia de coincidencias parciales y validación del ID. Sus respuestas HTTP son simuladas, no sustituyen la integración real.
- TypeScript con `--noUnusedLocals --noUnusedParameters`: aprobado.

## Comprobaciones reales

Se inició una instancia del backend compilado en HTTPS 7294, con configuración exclusivamente en memoria para `ControlFinancieroDB_Pruebas`. Antes de cada petición se comprobaron las sesiones SQL del PID 6588: base efectiva y nombre de aplicación exclusivo de esta ejecución. La instancia habitual 7202 no fue modificada ni detenida.

El arnés registró **134 respuestas HTTP con estado esperado**, incluyendo preparación y desactivación final. Resultados funcionales:

| Cuenta / combinación | Columnas por documento y por listado | Resultado |
| --- | --- | --- |
| PersonalArea | 4 | HTTP 200 en ambas |
| JefeArea | 6 | HTTP 200 en ambas |
| Auditor | 7 | HTTP 200 en ambas |
| Administrador | Ninguna | HTTP 403 en ambas |
| Administrador + PersonalArea | 4 | HTTP 200 en ambas |
| Administrador + JefeArea | 6 | HTTP 200 en ambas |
| Administrador + Auditor | 7 | HTTP 200 en ambas |
| PersonalArea + JefeArea | 6 | HTTP 200 en ambas |
| JefeArea + Auditor | 7 | HTTP 200 en ambas |

- Se inspeccionaron las 16 exportaciones permitidas: encabezados, cantidad exacta de columnas, fecha, importe, descripción y, cuando correspondía, ID, área y creador. Cada documento contenía 12 filas. El listado contenía 12 para los perfiles locales y 10 061 para Auditor y sus combinaciones, incluidos los registros existentes autorizados y las dos nuevas áreas QA. Esta fue una exportación ordinaria, no una repetición de O6 ni una prueba de estrés.
- En los ocho perfiles financieros: ID propio 21049 → una fila; inexistente 2147483647 → ninguna; prefijo del ID → únicamente igualdad exacta, nunca 21049; ID ajeno 21061 → ninguna fila para perfiles locales y una para Auditor. El detalle y la exportación del documento ajeno devolvieron 404 para los perfiles locales y 200 para Auditor.
- IDs `0`, `-1`, `2147483648` y `abc`: HTTP 400 real.
- Documentos: el listado local incluyó el documento propio 2014 y excluyó el ajeno 2015; los 12 registros del documento propio se consultaron correctamente.
- Importación: dos archivos válidos pasaron vista previa y confirmación reales (12 + 2 filas). La exportación de PersonalArea pasó nuevamente la vista previa con 12 filas válidas, sin confirmarla otra vez ni duplicar registros. Los formatos ampliados de JefeArea y Auditor fueron rechazados en vista previa por el contrato existente de cuatro columnas. **El contrato de importación no cambió; los archivos ampliados no son plantillas de importación.**

### Angular contra la API real

Se utilizó el navegador integrado y un relé local 4307 hacia Angular 4200 y la API HTTPS 7294. Se registraron 12 respuestas HTTP del recorrido, todas 200, sin guardar cuerpos de autenticación.

- Se recorrieron las dos páginas de los 12 registros y se buscó 21049 desde la segunda página: una fila, página 1.
- Se combinaron ID, descripción, operación, área y fechas 14/11/2026: un resultado; cambiar a Egreso devolvió cero. Limpiar únicamente el ID conservó los filtros y mostró los seis ingresos.
- Se comprobaron ID inexistente e ID de otra área sin filtros adicionales: cero resultados. El valor 0 mostró validación y deshabilitó Buscar.
- Se accionaron las dos exportaciones desde Angular: HTTP 200 real.
- Se consultaron las dos páginas del documento, conservando la tabla existente sin el nuevo campo ID.
- Presentación comprobada en escritorio y a 390 px: filtros apilados sin solaparse, fechas accesibles y tabla con desplazamiento horizontal propio. No se repitió la matriz Chrome/Edge aprobada anteriormente.

## Datos y evidencias

- Áreas nuevas exclusivas QA: 2025 y 2026. Diez usuarios temporales con prefijo de ejecución. Se conservaron dos documentos y 14 registros nuevos (21049–21062) como trazabilidad, creados mediante importación real.
- Al finalizar, los diez usuarios y las dos áreas quedaron inactivos, comprobado por SQL. La huella SHA-256 de los registros financieros previos, incluidos sus RowVersion, coincidió antes y después. No se alteraron registros ajenos.
- La API aislada y el relé fueron detenidos. No hubo cambios de entidades, contexto, migraciones, configuración de producción ni operaciones sobre la base principal.
- Evidencias locales excluidas de Git: `frontend/docs/evidencias-exportaciones-bloque-2/QA_EXP_B2_20261115045253/resultado.json`, archivos XLSX, `angular-comprobaciones.json` y capturas `registros-filtros.png` / `registros-movil.png`. El arnés reproducible está en `frontend/scripts/validate-exports-block-2.mjs`; solicita credenciales ocultas y no guarda contraseñas ni JWT.

## Límites y cierre

- La comprobación de estos nuevos formatos Excel fue de contenido estructural y mediante descarga real; no se repitió su apertura en Microsoft Excel. La apertura previa de O10 continúa siendo evidencia histórica de los formatos anteriores, no una validación nueva de estos archivos.
- Para utilizar el cambio en la instancia habitual, debe reiniciarse esa API con el backend actualizado; las pruebas de este bloque se ejecutaron contra la instancia aislada indicada.
- No se encontraron fallos funcionales adicionales durante estas comprobaciones. Sin commits ni push. El Bloque 3 no se inició.
