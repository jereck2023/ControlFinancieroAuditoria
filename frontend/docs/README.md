# Documentación publicable y evidencias locales

El estado vigente del proyecto está en [revision-tecnica-final.md](revision-tecnica-final.md) y [plan-validacion-integral.md](plan-validacion-integral.md). Los informes por entrega conservan resultados históricos; los cierres de O3 y O6 los complementan. No ejecutar otra vez las integraciones para leer o compilar este repositorio.

Se versionan las decisiones de arquitectura, contratos, limitaciones, informes de validación y las dos confirmaciones manuales de O10 en texto. Sus usuarios/IDs QA describen datos sintéticos de pruebas, no personas reales. Se omitió el nombre identificable del equipo SQL en los informes que lo contenían.

Las capturas, exportaciones XLSX y respuestas JSON crudas de `evidencias-*`, así como `scripts/o3/evidencias` y el inventario local generado de Git, se conservan en el equipo de trabajo y se excluyen mediante .gitignore. No se borraron. Algunos enlaces históricos apuntan a esos archivos locales: **un clon no incluirá esos anexos**, mientras que el resultado y las referencias de cada prueba permanecen documentados. Si se necesitan como anexos de sustentación, compartirlos separadamente después de revisar su contenido y destinatarios.

Para compilar y ejecutar las pruebas automatizadas solo se requieren las fuentes, el asset local, package.json/package-lock.json, angular.json y los tsconfig incluidos. `npm ci`, `npm test` y `npm run build` no requieren las evidencias locales ni los arneses de integración.

`scripts/*.mjs` y `scripts/o3` son herramientas manuales conservadas como código de pruebas. No son un segundo frontend, no se ejecutan por npm test/build y algunas realizan escrituras QA. Dependen de entorno SQL/API y fixtures históricos específicos; no se presentan como una suite de integración independiente reproducible en cualquier clon. El arnés O3 también necesita la copia temporal y su manifiesto, deliberadamente fuera de Git. No ejecutarlos contra datos reales ni para regenerar evidencias automáticamente.

Véase [preparacion-github.md](preparacion-github.md) para el conjunto candidato y los commits propuestos.
