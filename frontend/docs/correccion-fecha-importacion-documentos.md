# Corrección de la fecha de importación de Documentos

15/11/2026, hora de Perú. Ejecución `QA_DOC_TIME_20261115074232`.

## Cambio aprobado

Se corrigió exclusivamente la fecha de importación en el listado y detalle de documentos financieros:

- `DocumentsApi.list()` y `.get()` normalizan las marcas sin zona explícita añadiendo `Z`, porque el backend las almacena en UTC. Conservan las marcas que ya contienen `Z` o un offset, su precisión y los demás campos. No se muta la respuesta original.
- Las dos plantillas muestran esa fecha con `DatePipe`, formato previo `dd/MM/yyyy HH:mm` y zona fija `-0500`, independiente de la zona del navegador.
- Ambas etiquetas ahora indican **«Importación (hora de Perú)»**. Sin cambios de componentes, estilos SCSS, tarjetas, tablas ni distribución.
- No se modificaron backend, contratos SQL, fechas almacenadas, entidades, migraciones ni código de otros módulos.

Archivos funcionales modificados:

1. `src/app/features/financial-documents/data-access/documents-api.ts`.
2. `src/app/features/financial-documents/pages/documents-list.html`.
3. `src/app/features/financial-documents/pages/document-detail.html`.

Soporte añadido: `documents-api.spec.ts`, `pages/document-dates.spec.ts`, `scripts/validate-document-import-date.mjs` y este informe. Se actualizó el estado del hallazgo en `docs/validacion-final-cuatro-bloques.md`.

## Pruebas automatizadas y compilación

**23 pruebas relevantes aprobadas en cinco archivos**, incluidas seis pruebas nuevas de Documentos. Los otros archivos seleccionados cubren fechas de trazabilidad y contratos HTTP financieros que también utilizan `DocumentsApi`.

- Listado y detalle normalizan fechas sin sufijo; no duplican `Z` ni convierten dos veces fechas que ya tienen offset.
- Ambas vistas muestran el caso confirmado del documento QA 2014 como `14/11/2026 23:53`, sin la hora incorrecta 09:53.
- Casos de medianoche y cambio de año, conservación del número de registros y del resto de metadatos.
- Todas las respuestas HTTP de esos specs son **simuladas**. La prueba real se describe por separado.
- Compilación de producción Angular aprobada, paquete inicial 523,11 kB. No se repitieron las 166 pruebas completas ni se recompiló el backend sin cambios.

## Verificación real del documento 2014

Se utilizó el backend ya compilado en una instancia HTTPS 7298, PID 20620, con configuración de proceso exclusivamente para `ControlFinancieroDB_Pruebas`. Se verificaron las sesiones SQL del proceso antes de las peticiones y escrituras de preparación. Sin modificar configuraciones originales.

| Origen | Resultado real |
| --- | --- |
| SQL y API, sin cambios | `2026-11-15T04:53:32.7419396`, UTC |
| Conversión SQL de referencia a Perú | `2026-11-14T23:53:32.7419396` |
| Listado de Angular | `14/11/2026 23:53`, etiqueta «Importación (hora de Perú)» |
| Detalle de Angular | `14/11/2026 23:53`, etiqueta «Importación (hora de Perú)» |

Comprobado en navegador integrado, mediante relé local 4311 hacia Angular 4200/API HTTPS 7298, con la cuenta Auditor QA existente. Se conservan el documento, sus doce registros y la paginación en dos páginas. La captura muestra el diseño institucional anterior con la fecha corregida.

El arnés registró nueve respuestas HTTP esperadas, incluidas preparación y restitución; el recorrido del navegador tuvo cuatro respuestas HTTP 200. No se importó, exportó ni modificó información financiera.

## Restitución y evidencias

- Se reactivaron temporalmente solo el área QA 2025 y el Auditor QA 3037. Ambos volvieron a estar inactivos, comprobado mediante SQL; no se cambiaron roles ni contraseñas.
- La comparación completa de la fila SQL del documento 2014 y la huella de los registros financieros antes/después resultaron iguales. Las fechas almacenadas permanecieron intactas.
- Se detuvieron la API aislada y el relé. No se realizaron operaciones sobre `ControlFinancieroDB`.
- Evidencias locales ignoradas por Git: `docs/evidencias-correccion-fecha-documentos/QA_DOC_TIME_20261115074232/resultado.json`, `navegador.json` y `documento-2014-hora-peru.png`. Sin credenciales ni JWT.
- **Hallazgo de presentación resuelto en el alcance probado.** La apertura manual de los tres Excel de la validación anterior continúa pendiente; no fue repetida ni forma parte de esta corrección. Sin commits ni push.
