# O6 · Aprobada realmente: fronteras de exportación 10000 / 10001

## Resultado vigente · 12/11/2026, Perú, 20:27

**O6 aprobada.** Ejecución `QA_O6_20261113011722`, exclusivamente en **ControlFinancieroDB_Pruebas**. La conexión efectiva de la API fue verificada mediante PID/puerto 7202 y sesiones SQL antes de la preparación, en las llamadas directas del arnés y nuevamente antes de la exportación de recuperación/cierre. No se modificaron backend, límites, migraciones ni otras bases.

| Comprobación real | Resultado |
| --- | --- |
| Alcance original reutilizado | Área **24**, QA_B2_20261112095714_A, documento **12**, **500 registros** del 12/11/2026; cuentas 1027/1028/1029 inactivas y solo QA. |
| Preparación mínima autorizada | **19 importaciones de 500** por vista previa/confirmación de la API: **9500 nuevos**; un único movimiento adicional por POST: **registro 20546**. Sin reimportar el documento 12 ni usar inserciones SQL. |
| Límite 10000 | **HTTP 200**, a las **20:24:53 Perú**. XLSX **357349 bytes**, **10000 IDs únicos**, exactamente el conjunto esperado. Se compararon por fila ID, fecha, tipo, descripción, monto, área, nombre del creador y documento. |
| Límite 10001 | **HTTP 400**, a las **20:24:58 Perú**: «La exportación supera el límite de 10000 operaciones. Reduzca el período o los filtros.» |
| Angular frente a 10001 | Recorrido real en navegador; la descarga recibió **400** a las **20:26:02**, y se mostró exactamente el mensaje del servidor. El formulario siguió disponible y mantuvo área/fechas. |
| Recuperación de filtros | Seleccionar **Egreso**, volver a generar: **5000 resultados**, sin mensaje residual. Exportación real desde Angular **200**, a las **20:27:04**, descarga recibida y archivo confirmado con **5000 filas**. |
| Restauración y trazabilidad | Área **24 inactiva** y nueva cuenta **2026 inactiva**, confirmadas por SQL a las **20:27:59**. **9501 historiales de creación**, **19 actividades ImportacionExcel** y documentos/registros conservados. Digest de los 500 originales (incluida RowVersion) y estado de las cuentas anteriores sin cambios. |

Filtros del límite: **fechaDesde=2026-11-12, fechaHasta=2026-11-12, areaId=24**, todas las operaciones y todos los documentos; sin documento específico que excluya el conjunto acumulado. En recuperación se añadió **tipoOperacion=Egreso**. Solo se utilizó ese alcance QA, sin datos ajenos.

Nuevos documentos **1012–1030**; registros importados **11046–20545**, más el manual **20546**. Los originales **10047–10546** siguen vinculados al documento **12**. Los saltos de identidad no se interpretaron como registros faltantes: la verificación usa conjuntos exactos de IDs. Nuevo operador **2026**, `qa_o6_20261113011722.operador`, PersonalArea + Auditor; no se reactivaron las tres cuentas anteriores. El nombre del área tampoco cambió.

## Error del arnés y reanudación autorizada

Tras las 19 importaciones, el primer GET de exportación ya había devuelto 200, pero el lector del arnés no reconocía las etiquetas XML con prefijo `x:` y contaba cero filas. Se detuvieron las nuevas escrituras antes del registro 10001 y se explicó el fallo. El usuario autorizó corregir solo ese lector y reanudar **sin reimportar**.

Se corrigió el tratamiento de prefijos, se comprobó localmente contra un archivo existente (sin nuevas solicitudes API), se reconstruyó el conjunto esperado leyendo los 10000 registros ya preparados y se repitió únicamente la exportación afectada para acreditar su contenido. El resultado inicial no se contó como prueba aprobada. Se conserva el evento de error en resultado.json. No fue un defecto del backend ni de Angular.

## Evidencias y límites de lo comprobado

- [Resultado API/SQL y trazabilidad por importación](evidencias-o6/QA_O6_20261113011722/resultado.json): hashes de archivos, documentos, rangos de IDs, estados HTTP, comparación de los originales y restauración final.
- [Archivo real de 10000 operaciones](evidencias-o6/QA_O6_20261113011722/detalle-10000.xlsx), SHA256 `db86836d80f3e5afc0b451f279f9c63d4a9e774e205e46b07b266107cae4fc67`.
- [Observación real de Angular](evidencias-o6/QA_O6_20261113011722/angular-evidence.json), [rechazo visible](evidencias-o6/QA_O6_20261113011722/angular-rechazo-10001.png) y [recuperación visible](evidencias-o6/QA_O6_20261113011722/angular-recuperacion-egreso.png).
- [Conteo del archivo de recuperación](evidencias-o6/QA_O6_20261113011722/recuperacion-archivo.json). Su nombre concreto y la respuesta 200 están en el resultado del relé.

El navegador utilizó **http://localhost:4306**, relé local hacia el Angular habitual **4200** y su proxy API real; no se simularon respuestas. El relé solo conservó rutas/estados/cuerpos de exportación, nunca Authorization, credenciales o respuestas de login. Se cerró sesión y se detuvo el relé al terminar; arnés finalizó con código **0**. Credenciales/JWT solo en memoria y entrada oculta.

La comprobación del contenido XLSX fue automatizada sobre el archivo real, no una apertura nueva en Microsoft Excel. La visualización en Excel de O10 no se repitió ni se atribuye a este archivo. No hubo prueba de estrés, nuevo build Angular o cambios en el producto. El arnés pasó comprobación sintáctica de Node; sus comprobaciones contra API/SQL y el recorrido de navegador descritos son reales, no HTTP simulado. No quedan errores funcionales pendientes de O6.

## Historial de la primera revisión — sustituido por el cierre anterior

Fecha: 12/11/2026, Perú. **Solo verificación previa; no se prepararon datos ni se ejecutaron exportaciones.**

## Evidencia real de lectura

- Se ejecutó `node frontend/scripts/validate-block-2.mjs --verify`: resultado **API efectiva exclusiva: ControlFinancieroDB_Pruebas**. El verificador identifica el proceso que escucha en 7202 y exige que sus sesiones SQL utilicen únicamente esa base.
- Consulta SQL explícitamente conectada a ControlFinancieroDB_Pruebas: área **24**, nombre **QA_B2_20261112095714_A**, **Activo=0**.
- El alcance completo de esa área contiene **500 registros**, todos vinculados al documento **12**, fecha mínima y máxima **2026-11-12**. No hay otros documentos/registros en el área según la agrupación consultada.
- Consulta utilizada: `SELECT DocumentoFinancieroId,COUNT(*) AS Operaciones,MIN(FechaOperacion),MAX(FechaOperacion) FROM RegistrosFinancieros WHERE AreaId=24 GROUP BY DocumentoFinancieroId`.

## Condición que impide continuar

Los 500 movimientos son candidatos reutilizables, pero el área está inactiva. Para incorporar los **9500 faltantes** al mismo alcance QA y el movimiento adicional de frontera se necesita reactivarla temporalmente. Eso modifica un dato existente; la instrucción actual exige detenerse si la preparación lo requiere. No se eludirá la validación del área por SQL, cambios de roles o modificación del backend.

Propuesta concreta para autorizar: activar únicamente el área QA **24** mediante su endpoint, crear operadores QA nuevos, importar **19 documentos de 500 filas** hasta completar 10000 movimientos del área/fecha, comprobar la exportación real de 10000, agregar **1** movimiento QA y comprobar el rechazo de 10001 y la recuperación de filtros en Angular. Al terminar, desactivar las cuentas nuevas y devolver el área **24** al estado inactivo. No modificar los 500 movimientos originales ni las cuentas QA anteriores. Los nuevos registros/documentos se conservarán para trazabilidad, sin prometer borrado inexistente en la API.

## Estado de aceptación

- Operaciones exportadas en esta ejecución: **ninguna**.
- Respuesta HTTP del límite de 10000: **no comprobada**.
- Respuesta HTTP del límite de 10001: **no comprobada**.
- Mensaje y recuperación en Angular: **no comprobados**.
- No hubo escrituras SQL/API, nuevos archivos de importación, cuentas/áreas o registros; no se accedió a ControlFinancieroDB ni se modificó backend, migraciones o límites.

**O6 no aprobada. Pendiente de autorización explícita para reactivar el área QA existente antes de continuar.** No se repitieron pruebas funcionales aprobadas.
