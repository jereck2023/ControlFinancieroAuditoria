# Módulo 4: registros, documentos e importación/exportación

Implementado el 11 de noviembre de 2026 exclusivamente en `frontend`. Sin cambios de backend, migraciones, dependencias ni configuración de producción.

## Contrato revisado antes de implementar

Se revisaron `RegistrosFinancierosController`, `DocumentosFinancierosController`, DTO de creación/actualización/consulta/documentos/vista previa, `ExcelFinancieroService` y la precisión SQL definida por EF.

| Endpoint existente                                      | Uso                                            |
| ------------------------------------------------------- | ---------------------------------------------- |
| GET `/api/registros-financieros`                        | Lista completa del alcance autorizado          |
| GET `/api/registros-financieros/{id}`                   | Detalle y RowVersion                           |
| POST `/api/registros-financieros`                       | Creación individual                            |
| PUT `/api/registros-financieros/{id}`                   | Actualización con RowVersion                   |
| GET `/api/registros-financieros/exportar`               | Excel del alcance completo                     |
| GET `/api/documentos-financieros`                       | Documentos autorizados                         |
| GET `/api/documentos-financieros/{id}`                  | Metadatos y hash de origen                     |
| GET `/api/documentos-financieros/{id}/registros`        | Registros del documento                        |
| GET `/api/documentos-financieros/{id}/exportar`         | Excel con los registros actuales del documento |
| POST `/api/registros-financieros/importar/vista-previa` | Multipart `archivo`                            |
| POST `/api/registros-financieros/importar/confirmar`    | Multipart `archivo` y `hashArchivo`            |

No se añadieron filtros/paginación HTTP que estos endpoints no admitan, descarga del original, endpoint de plantilla, eliminación ni campos ficticios de proveedor/estado/última modificación.

## Permisos

- Consulta y exportación: `PersonalArea`, `JefeArea` o `Auditor`. Administrador solo no puede acceder.
- Personal/Jefe sin Auditor: solo su área activa. Auditor: alcance global, incluso con área propia inactiva.
- Crear, editar e importar: requiere `PersonalArea` y área propia activa. `PersonalArea + Auditor` no amplía el área de escritura.
- Menús y guards usan políticas explícitas, sin jerarquía ni selector de rol activo. La API sigue siendo la autoridad sobre área/estado/propiedad.
- La sesión actual no incluye AreaId y no existe `/me`. La interfaz no deduce el área a partir de registros históricos ni solicita usuarios sin autorización. Un usuario con PersonalArea puede abrir el formulario de edición; el servidor resuelve la propiedad al guardar y rechaza un registro de otra área con 404. Los mensajes no afirman permisos individuales que el frontend no puede conocer.

## Organización

- `features/financial-records`: requests/responses numéricos del contrato, modelos de presentación, adaptadores de decimal, servicios, tabla reutilizable y páginas de listado/detalle/formulario.
- `features/financial-documents`: servicio y DTO de consulta; listado y detalle con la tabla de registros compartida.
- `features/financial-import`: contratos multipart, adaptador de vista previa y página con selección, validación, errores por fila, revisión paginada y confirmación.
- `core/http/file-download.ts`: descarga Blob, nombre seguro y lectura de errores del servidor al descargar.
- Se reutilizan encabezados, mensajes, errores de campos, paginación, confirmación modal, sesión, guards y estilos institucionales.

## Importes y concurrencia

Los DTO JSON exponen `monto` como número decimal. En presentación se conserva como texto decimal exacto; la API se lee como texto y se adapta mediante el contexto de origen de `JSON.parse`, evitando perder céntimos antes de representar el número. Los requests se serializan con un literal JSON numérico validado, no con un string numérico ni una conversión de coma flotante. No se añadió una biblioteca de precisión. La técnica utiliza la [propiedad de origen documentada por MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

El navegador debe soportar el contexto `source` del reviver JSON (comprobado en el navegador utilizado). Si no lo soporta, se informa de que debe actualizarse, sin mostrar importes redondeados. Se comprobó `9999999999999999.99` tanto en la API como en la tabla de Angular.

El almacenamiento real es decimal(18,2). Los formularios aceptan hasta dos decimales, punto o coma decimal y sin separadores de miles. Esto evita redondeo implícito al guardar: los DTO manuales tienen rango pero no una validación explícita de escala, mientras que el importador sí rechaza más de dos decimales. No se atribuye al backend manual una validación que no tiene.

Editar carga RowVersion desde el GET y lo reenvía sin modificar. Un 409 impide reintentar con la versión obsoleta: se conserva el estado del formulario y se ofrece cargar la versión vigente, avisando que reemplazará los valores pendientes. No hay reintento automático ni sobrescritura forzada. La respuesta sin cambios puede omitir RowVersion; se vuelve a consultar mediante la vista de detalle.

## Importación y exportación

- Solo `.xlsx`, máximo 2 MiB, nombre hasta 255 caracteres y hasta 500 registros.
- Hoja `RegistrosFinancieros`; cuatro columnas exactas y ordenadas: TipoOperacion, Descripcion, FechaOperacion y Monto.
- Sin fórmulas ni columnas adicionales. Descripción de 1–250 caracteres, Ingreso/Egreso, fecha Excel o texto dd/MM/yyyy y monto numérico positivo con máximo dos decimales.
- La API valida el contenido. El navegador no interpreta ni edita Excel. La vista previa es una tabla de solo lectura, con errores y registros válidos separados y paginados.
- Seleccionar otro archivo invalida la vista previa. Confirmar reenvía el mismo objeto File y el hash recibido. Mientras se procesa se bloquean nuevas acciones; tras éxito se liberan archivo y vista previa.
- Se respetan los rechazos por hash, filas inválidas y duplicado dentro del área. El mismo contenido puede importarse en otra área, como permite el backend.
- Los filtros de pantalla no afectan las exportaciones. Se rotulan explícitamente el alcance completo y el documento completo. El Excel se genera en el backend con los valores actuales; no se presenta como archivo original ni se promete una reimportación directa de ese formato exportado.

## Validación automatizada y compilación

`npm.cmd test`: **83 pruebas aprobadas en 16 archivos**, con HTTP simulado. Se incluyen precisión máxima, fechas y validaciones, requests numéricos exactos, multipart, aislamiento de archivo/hash, invalidación de vista previa, bloqueo ante errores, concurrencia 409 y las 16 combinaciones de roles para las políticas compartidas. La suite anterior se ejecutó porque se ampliaron políticas y utilidades compartidas; no se repitió su aceptación real.

`npm.cmd run build`: producción compilada correctamente, dentro del presupuesto existente. Sin dependencias nuevas. El formato y los scripts de integración también se comprobaron.

## Comprobaciones reales

La API del puerto 7202 se identificó por su PID y sus sesiones SQL apuntaban exclusivamente a `ControlFinancieroDB_Pruebas`. El validador `scripts/validate-module-4.mjs` comprueba ese estado antes de cada petición, incluidas las consultas que registran bitácora, y restringe escrituras a IDs propios. Las credenciales se reciben por stdin sin eco; tokens y contraseñas solo existen en memoria.

La ejecución `QA_M4_20261111095024` terminó con **116 comprobaciones reales aprobadas**, incluyendo preparación y limpieza (no son 116 escenarios independientes):

- Creación, consulta y modificación; versión vigente, versión obsoleta 409, RowVersion inválido 400 y actualización sin cambios. El conflicto no sobrescribió el registro.
- Monto cero/negativo y fecha inválida rechazados. Monto máximo conservado exactamente.
- Vista previa/confirmación reales de XLSX; hoja/encabezados/fórmulas/monto/fila 501 inválidos; tamaño y extensión rechazados; hash incorrecto rechazado; confirmación de filas inválidas bloqueada; duplicado por área 409 y mismo archivo en otra área admitido.
- Detalle y registros del documento. Exportaciones de documento y alcance examinadas como ZIP/OOXML real, con contenido esperado y sin los registros de la otra área en el alcance local.
- Las 15 combinaciones de roles no vacías: consulta de registros/documentos, lectura de documento de otra área, creación y edición fuera de área. Auditor consulta globalmente; PersonalArea solo escribe en su área, incluso combinado con Auditor. Administrador exclusivo obtiene 403.
- Auditor combinado conserva lectura global con su área inactiva y no puede crear en ella.

### Navegador, con la API real

- Listado, búsqueda y cambio de página; visualización exacta del monto máximo.
- Creación manual desde Angular, entrada de coma decimal y consulta del detalle persistido (registro 10028).
- Dos pestañas editaron el mismo registro: una guardó y la otra recibió el conflicto. La segunda cargó la versión vigente sin sobrescribirla.
- Selección de XLSX temporal, validación, vista previa, confirmación, detalle del documento importado y descarga iniciada desde el botón de exportación (documento 8, registro 10029).
- Vista móvil 390 × 844: se corrigió el recorte de nombres largos de archivo. Después, el ancho del documento fue 375 px con viewport de 390 px; las tablas mantienen scroll interno. Se restauró el viewport y se cerraron ambas sesiones QA.

## Datos de prueba y límites

La ejecución completa creó áreas 14/15, cuentas 1014/1015, registros 10013–10027 y documentos 5/7; el navegador añadió los registros 10028/10029 y el documento 8, siempre bajo el mismo prefijo QA. Las cuentas y áreas propias quedaron desactivadas por la API.

Una ejecución preliminar `QA_M4_20261111094748` aprobó 20 comprobaciones, incluida su limpieza, y se interrumpió porque su guard de prefijo bloqueó el caso deliberado de descripción vacía antes de enviarlo. Se omitió ese caso en el validador, sin cambiar la API. Sus áreas 12/13 y cuentas 1012/1013 quedaron inactivas; sus registros propios 10011/10012 permanecen identificados para auditoría. La descripción vacía se cubre mediante el validador de formularios y la revisión del backend, no se declara probada en vivo en esta entrega.

No existen endpoints para eliminar registros/documentos. Los datos QA permanecen identificables en la base de pruebas; no se eliminaron directamente por SQL ni se alteraron registros ajenos. No se hicieron cambios en la base principal.

La consulta final de solo lectura confirmó inactivas las áreas 12–15 y las cuentas 1012–1015. Identificó 19 registros QA (2 de la ejecución preliminar y 17 de la completa más navegador) y tres documentos QA (5, 7 y 8); la API seguía conectada exclusivamente a `ControlFinancieroDB_Pruebas`. Git no reportó cambios en el directorio backend.

No se realizó prueba de carga con volúmenes masivos: la API devuelve listas completas y la paginación es local. La precisión comprobada en JSON/Angular no garantiza que una aplicación de hojas de cálculo preserve todos los dígitos al abrir importes extremos del Excel generado por el backend. Tampoco se declara validación visual de cada combinación de roles: esa matriz se comprobó mediante HTTP real y pruebas de políticas, y el flujo visual se realizó con PersonalArea.
