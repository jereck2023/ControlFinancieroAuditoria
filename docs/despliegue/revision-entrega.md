# Revisión de archivos antes de publicar

Fecha: 17/11/2026. Repositorio `C:/Proyectos/CFA`, rama `main`. No se hicieron commits, push ni cambios en el índice. Los cambios anteriores de los cuatro bloques se conservaron.

## Material que debe conservarse en la entrega

- Código fuente backend/frontend, proyectos, las 12 migraciones y su snapshot, pruebas automatizadas, configuración sin secretos y archivos de dependencias, incluido package-lock.json.
- Documentación seleccionada y estos archivos de despliegue: SQL, manifiesto, instrucciones y fuentes del generador. El script no contiene un volcado de información del sistema.
- Los cambios pendientes de backend incluyen AreasController, DocumentosFinancierosController, RegistrosFinancierosController y ExcelFinancieroService; son anteriores a esta preparación. También siguen nuevos UsuariosAreaController, FiltroRegistrosFinancierosRequest, UsuarioAreaResponse y PerfilExportacionFinanciera. Esta tarea no modificó ninguno.
- Siguen pendientes los cambios anteriores del frontend, sus pruebas y documentación de los cuatro bloques, fechas de documentos y ajustes de alertas/menú. Deben revisarse como parte de esos bloques, no atribuirse a la generación SQL.

## Material que debe permanecer local o revisarse

- node_modules, dist, bin, obj, cachés Angular, cobertura, registros, archivos temporales y configuraciones privadas: cubiertos por las exclusiones existentes. No se detectaron esos artefactos entre los archivos versionados o nuevos no ignorados.
- Respaldos, certificados privados, archivos de base de datos y carpetas de evidencias QA crudas: ya excluidos. Incluye exportaciones Excel, capturas y evidencias del arnés O3. No se eliminaron archivos locales.
- Las excepciones de .gitignore que permiten dos confirmaciones manuales de O10 merecen revisión editorial antes de publicar, como el resto de documentación de pruebas. No confundir esas confirmaciones con las evidencias crudas excluidas.
- `frontend/scripts/validate-*.mjs`, `inspect-report-export.mjs` y `frontend/scripts/o3` son herramientas de pruebas, no requisitos de ejecución del producto. Revisar si se entregan como material técnico complementario; no ejecutar indiscriminadamente sus operaciones sobre una instalación nueva. Algunos están ligados a datos y condiciones QA del entorno local.
- El archivo appsettings.json versionado contiene un destino SQL local por autenticación integrada y apunta a ControlFinancieroDB. No tiene contraseña SQL, pero el nombre del servidor/base es información del entorno y debe revisarse antes de publicación. No se modificó. No usar su destino predeterminado para preparar una instalación nueva.

Se realizó una búsqueda estática en fuentes/configuraciones/documentación/SQL versionados o nuevos no ignorados de contraseñas conocidas, JWT literales, claves privadas y contraseñas de conexión. Los candidatos de Password correspondieron a variables, lectura de configuración/entrada y selección de un campo de formulario, no a valores secretos. No se detectaron credenciales reales mediante esas búsquedas. Esto no sustituye una revisión de secretos del historial de Git ni certifica la ausencia de todo dato personal; los informes y herramientas QA deben tener una última revisión editorial antes de publicación.

## Comentarios y codificación

- En Program.cs del backend permanecen comentarios de plantilla en inglés: líneas 42, 112 y 153 (servicios, documentación OpenAPI y pipeline). Son candidatos a limpieza editorial, sin efecto funcional; no se modificaron.
- Los comentarios de concurrencia, seguridad y reglas tienen utilidad técnica. Los encabezados autogenerados de migraciones no deben eliminarse como si fueran comentarios temporales.
- Program.cs no conserva sus bytes en una conversión de ida y vuelta UTF-8; al leerlo así aparecen cinco caracteres de sustitución. Conviene revisar su codificación antes de una eventual limpieza editorial. No se convirtió ni reescribió el archivo y no se deduce de esto un error de presentación del sistema.
- No se encontró una necesidad de eliminar comentarios automáticamente. Tampoco se modificaron los .gitignore existentes en esta tarea.

## Límites de esta revisión

No se abrió ninguna conexión a SQL Server, no se ejecutó el script y no se repitieron pruebas funcionales integrales. La validación de instalación y segunda ejecución idempotente requiere una futura base vacía expresamente autorizada. La revisión de Git corresponde al árbol de trabajo actual; no examina exhaustivamente todas las versiones históricas.
