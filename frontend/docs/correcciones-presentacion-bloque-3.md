# Bloque 3: historial, detalle y presentación

Validación del 15/11/2026 (Perú). Ejecución `QA_UI_B3_20261115051538`.

## Implementación

- «Ver cambios» del historial y «Ver detalle» de la bitácora ahora abren el mismo componente informativo modal. En el código existente, el segundo botón pertenece a Bitácora de actividades; esa dependencia se incluyó únicamente para reemplazar su panel inferior.
- No se conservó ningún panel inferior de detalle. El listado no se vuelve a consultar al cerrar el modal ni se reconstruyen sus filtros o página.
- El diálogo nativo proporciona la capa modal y el fondo inerte. Tiene título accesible, botón Cerrar enfocado inicialmente, Escape, recorrido circular con Tab/Mayús+Tab y devolución del foco al botón de origen. El fondo queda bloqueado y se conserva su posición; solo el cuerpo del diálogo permite desplazamiento. Su cabecera sigue disponible con contenido extenso.
- Se reutilizaron colores, tipografía, clases institucionales, botones y estilos de fondo existentes. Los estilos nuevos se limitan al componente modal y a la legibilidad de las columnas de cambios. Sin nuevas bibliotecas ni modificaciones del SCSS global.
- Se eliminó «Ver contenido completo del evento» y su visor. Solo se presentan los campos conocidos con etiquetas en español, valores anteriores/nuevos y fechas legibles. Los importes conservan su precisión exacta. Los campos desconocidos se omiten y las estructuras anidadas inesperadas no se convierten en un bloque técnico. No se cambió ni eliminó información almacenada.
- Reportes muestra exactamente: «Selecciona un período y los filtros correspondientes para generar tu reporte financiero».
- No se modificaron endpoints, permisos, backend, entidades, contexto, migraciones ni la implementación de los bloques 1 y 2.

## Archivos de este bloque

Dentro de `frontend/src/app`:

- Nuevos `shared/ui/information-dialog.ts`, `.scss` y `.spec.ts`, y `shared/ui/dialog-test-support.ts` (sustituto usado exclusivamente por pruebas JSDOM).
- `features/audit-history/pages/history-page.ts`, `.html` y `.spec.ts`.
- `features/audit-history/components/history-changes.ts` y `.html`.
- `features/audit-history/models/history-detail-view.ts` y `.spec.ts`.
- `features/activity-log/pages/activity-page.ts`, `.html` y `.spec.ts`.
- `features/financial-reports/pages/reports-page.html`.

Soporte: `frontend/scripts/validate-presentation-block-3.mjs` y este informe.

## Pruebas automatizadas y compilación

- Angular producción: aprobada, paquete inicial 523,13 kB.
- Backend Release: aprobado, cero advertencias y cero errores. No hubo cambios de código del backend en este bloque.
- Suite completa: **155 pruebas aprobadas en 35 archivos**, después del ajuste de teclado y desplazamiento.
- TypeScript con comprobación de imports/parámetros no utilizados: aprobado.
- Las pruebas de las páginas emplean HTTP simulado. Cubren el diálogo, cierre por botón/cancelación, conservación del listado, ausencia de paneles y visor crudo, escape de HTML y exclusión de campos desconocidos/anidados. El componente también se probó con texto extenso simulado. JSDOM no implementa los métodos nativos ni la geometría del diálogo: se sustituyeron solo en los tests. La navegación de teclado y el desplazamiento se comprobaron además en navegador real.

## Integración y navegador reales

API compilada en HTTPS 7295, PID 16512; configuración exclusivamente en memoria para `ControlFinancieroDB_Pruebas`. Se verificaron la base efectiva y el nombre de aplicación de las sesiones SQL del proceso antes de cada petición, incluidas las escrituras de preparación y restitución. La instancia habitual no fue detenida ni reconfigurada.

Se reutilizó el área QA 2025 y las cuentas QA 3036 (JefeArea) y 3037 (Auditor), verificando previamente sus nombres y estado inactivo. Se activaron temporalmente sin cambiar contraseñas, roles ni asignación de área. No se crearon registros financieros, documentos ni eventos de auditoría financieros para esta validación.

El arnés completó **25 comprobaciones HTTP**, incluidas preparación y restitución. Se registraron además **38 peticiones del recorrido de Angular**. Las pruebas de permisos, acotadas a estos dos módulos, confirmaron:

- JefeArea consultó el historial y las actividades del documento 2014 de su área. El filtro por documento 2015 de otra área devolvió un listado vacío y sus detalles HTTP 404.
- Auditor consultó ambos documentos y sus detalles HTTP 200, conservando alcance global.

En Angular, a través del relé local 4308 hacia Angular 4200 y la API 7295:

| Comprobación real | Resultado |
| --- | --- |
| Historial filtrado por documento 2014, 10 filas/página, página 2 | Conservó filtros, filas y página al abrir/cerrar |
| Historial 11079, apertura mediante Enter y cierre con Escape directo | Desplazamiento 182 → 182 → 182; foco devuelto al botón original |
| Bitácora del documento 2014, página 2, detalle 3999 | Conservó filtros, filas y página; desplazamiento 404 → 404 → 404 en la comprobación con teclado directo |
| Cierre visible en ambos modales | Cerró sin insertar paneles bajo las tablas |
| Tab/Mayús+Tab | Tras la corrección, el foco permaneció dentro del modal; seis pasos finales del historial aprobados |
| Modificación real 44, registro QA 10031 de otra área, como Auditor | Descripción anterior/nueva y monto exacto `9999999999999999.98` → `9999999999999999.99`; opción de incluir campos sin cambios comprobada |
| Ausencia de visor crudo | Sin `pre`, `details`, opción de contenido completo ni paneles inferiores en ambos detalles |
| Historial móvil 390×600, evento real con siete campos | Cuerpo de 504 px para 1175 px de contenido; desplazamiento interno 0 → 600, fondo constante en 182 incluso al desplazar sobre el fondo |
| Bitácora móvil 390×600, actividad 4046 de otra área como Auditor | Desplazamiento interno 0 → 25, fondo constante en 404; cierre visible accesible |
| Texto de Reportes | Texto solicitado visible; no se generó ningún reporte |

Los cambios de posición producidos al recentrar automáticamente botones fuera de vista con localizadores se distinguieron de los del modal: las mediciones definitivas de conservación utilizaron el botón ya enfocado y teclas directas.

## Hallazgos corregidos

1. El Tab nativo podía pasar momentáneamente al documento al terminar los controles. Se añadió el recorrido circular explícito y se verificó nuevamente en el navegador.
2. Se reforzó el bloqueo del fondo frente al desplazamiento suave y a cambios de tamaño de la página: se conservan altura y posición, se cancela el movimiento al abrir y se restauran los estilos previos al cerrar.
3. En la primera presentación, algunas etiquetas se partían innecesariamente. Se ajustaron únicamente el ancho mínimo de la columna de campos y la presentación de los estados del comparador.
4. El primer recorrido no pudo abrir Angular porque el servidor local no estaba activo. Se inició Angular y se completó el recorrido real. No fue un fallo funcional de CFA.

## Estado final y evidencias

- Las dos cuentas y el área QA regresaron al estado inactivo original, comprobado por SQL. La huella de los registros financieros, incluidos sus RowVersion, permaneció igual. Solo quedaron las actividades normales de acceso y administración de preparación/restitución.
- La API aislada y el relé fueron detenidos. No se ejecutaron operaciones sobre `ControlFinancieroDB` ni se modificó el esquema de ninguna base.
- Evidencias locales excluidas de Git: `frontend/docs/evidencias-presentacion-bloque-3/QA_UI_B3_20261115051538/resultado.json`, `angular-comprobaciones.json` y capturas de escritorio/móvil. Incluyen los hallazgos iniciales y sus comprobaciones posteriores; las mediciones finales se identifican expresamente. Sin contraseñas ni JWT.
- Sin limitaciones funcionales pendientes identificadas en el alcance probado. La revisión móvil fue con un tamaño de navegador de 390×600, no con un dispositivo físico. No se repitió la matriz completa de navegadores ni las pruebas integrales anteriores.
- Sin commits, push ni avance al Bloque 4.
