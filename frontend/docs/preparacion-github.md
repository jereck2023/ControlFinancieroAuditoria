# CFA · Selección para GitHub, sin commits

Fecha: 12/11/2026, Perú. Raíz comprobada: `C:/Proyectos/CFA`; rama actual **main**. Índice vacío: no se ejecutaron git add, commits ni push. No se eliminaron archivos ni cambiaron funcionalidades, fuentes del backend, migraciones o bases de datos.

## Selección propuesta

De los **291 archivos frontend** inventariados anteriormente, **62 anexos generados quedan excluidos**. Se añadieron dos documentos de preparación: este informe y docs/README.md. El conjunto publicable queda en **231 archivos nuevos frontend**:

| Grupo | Archivos | Contenido |
| --- | ---: | --- |
| src | 174 | Nueve módulos, core/shared/layout, HTML/SCSS, environment relativo /api, **32 archivos spec** y sus fixtures sintéticos. |
| Configuración/README/asset | 13 | package.json y package-lock.json, angular.json, tres tsconfig, proxy de desarrollo, .gitignore, .editorconfig, configuración Prettier, README y logotipo SVG local. |
| Documentación | 25 | Arquitectura, integración, resultados históricos, plan vigente, cierre técnico, O3/O6 y confirmaciones manuales de O10 en texto. |
| Herramientas fuente | 19 | Arneses MJS, utilidades de fixtures/lectura XLSX y proyecto/fuente/documentación del arnés O3. Sin resultados crudos ni binarios. |

Además, se versionaría el ajuste del **.gitignore raíz**, ya existente en Git. La única fuente versionada modificada del backend sigue siendo `Controllers/UsuariosController.cs`: movimiento autorizado del registro de bitácora antes de la desactivación, dentro de la misma transacción. Se comprobó el diff; no cambian otros métodos, reglas, bloqueo, aislamiento o migraciones. Su diff también contiene la normalización de la nueva línea final del archivo, sin efecto funcional.

## Exclusiones comprobadas, sin borrar

- node_modules, dist, .angular, coverage, tmp, bin/obj, logs y configuración local con secretos ya estaban excluidos. Se conservan ejemplos saneados como .env.example si se agregan; no se excluyen genéricamente los appsettings indispensables ni las migraciones.
- Se agregaron reglas acotadas en frontend/.gitignore para los JSON/XLSX/capturas crudos de docs/evidencias-*, capturas/exportaciones sueltas de docs, scripts/o3/evidencias y el inventario Git local generado. **Se exceptuaron expresamente las dos confirmaciones manuales O10 en Markdown.**
- El .gitignore raíz excluye respaldos/, referencias-ui/, los ZIP raíz CFA-backend-* y archivos de respaldo/base de datos .bak/.bacpac/.mdf/.ldf. El SVG del producto permanece incluido; las imágenes de referencia locales no son necesarias para ejecutar Angular.
- git check-ignore confirmó las exclusiones con archivos reales. La lista candidata no contiene artefactos binarios QA, temporales, dependencias instaladas o salidas de compilación. .gitignore no elimina archivos y no deja de seguir archivos ya versionados; no hizo falta retirar nada del índice.

Los anexos originales siguen disponibles localmente para la sustentación. Los informes conservan enlaces a esos archivos; un clon limpio no incluye tales anexos. Esta decisión está explicada en docs/README.md, sin presentar los enlaces locales como descargas disponibles en GitHub.

## Revisión de secretos y privacidad

Se inspeccionaron las fuentes/configuración versionadas y todos los archivos frontend candidatos: patrones de JWT literal, claves privadas, marcadores de credenciales QA, credenciales incrustadas en URL, asignaciones de secretos, contactos y rutas/nombres de equipo personales. No se detectaron credenciales reales, JWT válidos incrustados ni contactos personales en la selección.

Las alertas restantes corresponden al valor **sintético** de login.spec.ts (HTTP simulado) y a plantillas SQL del arnés que reciben un secreto aleatorio en memoria, sin valor persistido. No se eliminaron esos tests ni se confundieron con credenciales reales. Los nombres/IDs QA documentados son datos sintéticos, no personas reales.

Se omitió el identificador del equipo SQL en tres documentos de preparación/resultados; los JSON crudos originales quedaron fuera de Git. La cadena de conexión versionada del backend usa autenticación Windows local, sin contraseña SQL; los campos JWT/contraseña de AdminInicial no contienen secretos en appsettings.json. También se comprobó la única revisión histórica de ese archivo dentro de los 12 commits existentes: sin esos secretos. Esto no constituye una auditoría completa de cada blob de toda la historia ni del contenido de los respaldos excluidos.

## Compilación y reproducción del frontend

Se comprobó que están presentes y no ignorados package.json, package-lock.json, angular.json, tsconfig.json/app/spec, src/main.ts/index.html/styles.scss, environment.ts, SVG y los fixtures de las pruebas. Las dependencias y devDependencies del lockfile coinciden con package.json. Un clon puede instalar con `npm ci`, ejecutar `npm test`, compilar con `npm run build` y desarrollar con `npm start` (API/configuración local aparte).

No se reinstalaron paquetes ni repitieron pruebas funcionales: se conservan las compilaciones y **143 pruebas en 32 archivos** aprobadas en la revisión final. secure:false permanece únicamente en el proxy HTTPS local de desarrollo, sin credenciales ni destino remoto. Los arneses manuales requieren sus entornos/fixtures específicos; no se ejecutan con npm test/build y no se prometen reproducibles sin esa preparación.

## Dos commits propuestos — no ejecutados

1. **`feat(frontend): incorporar los nueve módulos de CFA con pruebas y documentación`** — .gitignore raíz y frontend seleccionado, incluidos lockfile, 32 specs, herramientas fuente e informes; excluidos anexos crudos y respaldos.
2. **`fix(usuarios): registrar bitácora antes de la autodesactivación`** — exclusivamente UsuariosController.cs, con referencia a la regresión real de O3 ya aprobada.

Antes de ejecutar esos commits se debe revisar la selección preparada con git diff --cached; **esta revisión no preparó el índice**. No se realizó ninguna operación remota ni se decidió visibilidad pública/privada del repositorio. No se propone un git add . indiscriminado.
