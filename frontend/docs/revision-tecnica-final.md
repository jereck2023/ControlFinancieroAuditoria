# CFA · Revisión técnica final para sustentación

Fecha: **12/11/2026, Perú**. Revisión sin conexiones a bases de datos, sin nuevos fixtures, sin repetir O1–O10 y sin commits/push. Las compilaciones generaron únicamente sus artefactos habituales; no se editaron fuentes/configuración/migraciones del backend. El único ajuste de esta revisión es documental, además de conservar el inventario Git.

## Verificaciones ejecutadas ahora

| Verificación | Resultado observado |
| --- | --- |
| `npm.cmd run build`, desde frontend | **Exit 0**. Configuración predeterminada **production**, Angular **22.2.5**, CLI/build **22.2.6**. Inicial **520.93 kB**, transferencia estimada **103.32 kB**, dentro del aviso de 550 kB. Salida `frontend/dist/cfa/browser`. |
| `npm.cmd test`, desde frontend | **Exit 0; 143/143 pruebas en 32/32 archivos**, Vitest 5.1.0. Duración reportada 23.86 s. Suite completa de unidad/componentes y contratos HTTP simulados; no llamadas a la API real ni SQL. |
| `dotnet build backend/ControlFinanciero.API/ControlFinanciero.API/ControlFinanciero.API.csproj --configuration Release --no-restore --verbosity minimal` | **Exit 0; 0 errores, 0 advertencias**, SDK 9.0.318. Incluye la corrección actual de UsuariosController. No se arrancó la API ni ejecutaron seeders/migraciones. Compilación con dependencias ya resueltas; no certifica instalación limpia o auditoría NuGet actualizada. |
| `npm.cmd exec -- tsc --noEmit --noUnusedLocals --noUnusedParameters -p tsconfig.app.json` | **Exit 0**, sin imports, variables o parámetros sin uso en las fuentes revisadas del frontend. |
| Inspección estática y artefacto | Sin advertencias del compilador Angular. **48 archivos**, **0 source maps**, sin proxy, archivos QA, fixtures, scripts de integración o puertos de prueba encontrados en el artefacto. No se sirvió el build ni se repitieron recorridos funcionales. |

Entorno local: Node **22.23.3**, npm **10.9.9**, TypeScript **6.0.3**, Bootstrap **5.3.8**, RxJS **7.8.2**. El lockfile fija las resoluciones. No se instalaron/actualizaron dependencias.

## Nueve módulos: resumen de cierre ya acreditado

Estas evidencias provienen de las ejecuciones aprobadas; **no se repitieron en esta revisión**. Las cifras históricas por entrega no se suman como si fueran pruebas independientes ni son la suite actual de 143.

| Módulo | Funcionalidad y evidencia real de cierre |
| --- | --- |
| 1. Autenticación | Login JWT, F5, logout local, cambio obligatorio, guards/interceptor, 401/403. O1 y suspensión real: exp natural y rechazo API del mismo JWT vencido. |
| 2. Áreas | Consulta, alta, edición, activación/desactivación según permisos. Formularios QA reales de O2. |
| 3. Usuarios | Alta/edición, roles múltiples, estado y contraseñas. O2 y O3: último administrador, autodesactivación corregida, bitácora y carreras reales conservando administrador activo. |
| 4. Gestión financiera | Documentos, tablas de consulta, formularios, importación validada/confirmada, exportaciones y RowVersion. O4 rechazos de descripción vacía; O5 500 filas exactas; O10 archivos ordinarios abiertos por el usuario en Excel. |
| 5. Historial | Quién/cuándo/valores anteriores y nuevos, filtros y detalle de solo lectura. O7 enlazó registro 10044, historial 69 y alerta 161 de modificación financiera fuera de horario. |
| 6. Bitácora | Consulta/detalle y trazabilidad según alcance. Verificación de actividades de cambios, importaciones, revisiones y cierres; sin edición/eliminación. |
| 7. Reportes | Resumen/detalle, filtros, agrupaciones admitidas, paginación y exportación API. O6: **10000 → 200**, contenido exacto; **10001 → 400**, mensaje Angular y recuperación a 5000 egresos. |
| 8. Anomalías | Detección manual por Auditor y explicación de reglas reales, incluidos intentos fallidos reiterados. O7 acredita la regla fuera de horario para una modificación financiera, no solo para un login. |
| 9. Alertas | Listado/detalle/evidencias, revisión y cierres justificados con RowVersion. O8 ajustó la última página; O9 acreditó pérdida real de respuesta y reconciliación sin reenvío; conflictos y trazabilidad. |

El plan vigente y sus enlaces constituyen el índice de evidencia: [plan-validacion-integral.md](plan-validacion-integral.md), [corrección O3](validacion-o3-correccion.md), [O6](validacion-o6.md), [suspensión Windows](validacion-suspension-windows.md). Excel y Chrome/Edge de O10 incluyen comprobaciones **manuales realizadas por el usuario**, no se atribuyen al agente.

## Calidad y arquitectura revisadas

- Angular standalone, rutas con carga diferida, TypeScript y plantillas estrictos. `core` concentra sesión/políticas/interceptor; `layout` la navegación; `shared` formularios, feedback, confirmaciones, paginación, consultas y trazabilidad; `features` separa páginas, componentes, servicios `data-access` y contratos `models/requests` / `models/responses`.
- Las llamadas HttpClient productivas están en servicios de acceso a datos. Las páginas coordinan estado/formularios; los servicios usan tipos de contrato o decodificadores explícitos cuando deben preservar decimales. Las respuestas de errores se tratan como unknown, sin any explícito encontrado en las fuentes productivas.
- QueryState cancela consultas anteriores, toma el ciclo de vida y separa resultados/errores/carga. Las escrituras no se reenvían automáticamente; reportes conservan filtros aplicados y alertas reconcilian versiones antes de permitir otro intento.
- Componentes de presentación y Bootstrap/SCSS locales reutilizados, sin interfaz de hoja de cálculo, CDN, librería de grillas, NgRx o dependencia Excel en el navegador. Las dependencias directas tienen uso justificable: Angular, RxJS, tslib y Bootstrap; CLI/compiler/TypeScript, Vitest/jsdom y Prettier son herramientas de desarrollo.
- Búsqueda estática sin console/debugger, TODO/FIXME/HACK, eval, innerHTML ni bypassSecurityTrust en código productivo. Los fixtures bajo src/testing solo sirven a pruebas y no aparecieron en el bundle revisado. Los arneses y copias temporales están separados del producto. No equivale a un pentest ni a prueba de ausencia de todas las vulnerabilidades.
- La búsqueda de patrones de contraseña de prueba/JWT literal en fuentes, documentación y scripts no encontró coincidencias. No se inspeccionó el contenido de respaldos/ZIP ni se certifica que una búsqueda por patrones cubra todo secreto posible. Revisar esos archivos antes de publicarlos.

No se identificó un defecto funcional nuevo que requiera corregir código durante esta revisión. Sí se corrigió una **inconsistencia documental**: README afirmaba que nunca se modificó backend y conservaba pendientes anteriores al cierre O3/O6; se agregó el estado vigente y la excepción autorizada de UsuariosController. Se conservaron los informes históricos.

## Desarrollo frente a producción

`npm start` usa `proxy.conf.json`, destino fijo HTTPS localhost:7202 y `secure:false` solo para el certificado autofirmado local. `ng build` no lo incorpora. En producción, el código utiliza **`/api` relativo**; no contiene servidor localhost de pruebas ni relés 4306/7293. No se cambió la validación TLS global ni configuraciones de producción.

El build activa `security.autoCsp`, hashes de contenido y CSP generada para scripts. Es una defensa parcial: el alojamiento debe completar y verificar cabeceras/estilos/conexiones y servir HTTPS. No declarar CSP/hardening completo por encontrar una metaetiqueta. El artefacto presupone raíz `/`; una publicación en subruta requiere revisar base href y servidor.

## Git pendiente, sin stage/commit/push

Inventario exacto: [revision-tecnica-final-git.txt](revision-tecnica-final-git.txt). El frontend está **completamente sin seguimiento**: el status abrevia `?? frontend/`, no significa que ya exista un commit del frontend.

Recuento de cierre: **291 archivos sin seguimiento en frontend**: 174 en src (incluidas sus pruebas), 80 en docs/evidencias, 24 en scripts/herramientas y 13 de configuración, README y recurso público. El inventario incluye este informe y su propio archivo; no incluye dependencias ni salidas ignoradas.

| Grupo | Qué conservar/revisar |
| --- | --- |
| Frontend producto | `frontend/src/**` (174 archivos), `public/assets/branding/cfa-mark.svg`, package/lock, angular/tsconfig y configuración editorial. Incluir el proxy únicamente identificado como desarrollo. |
| Backend | Un único archivo versionado modificado: `backend/ControlFinanciero.API/ControlFinanciero.API/Controllers/UsuariosController.cs`. Diff: movimiento de la llamada de bitácora dentro de DesactivarUsuario y normalización de fin de archivo. No hay cambios de otras fuentes/migraciones/configuración del backend. |
| Herramientas | `frontend/scripts/**`: arneses de integración y O3 .NET, verificadores y fixtures XLSX. Algunos generan datos o escriben al ejecutarse; no lanzarlos como chequeo genérico. No forman parte del bundle. |
| Documentación/evidencia | `frontend/docs/**` y evidencias JSON/PNG/JPG/XLSX; evidencia O3 también en scripts/o3/evidencias. Seleccionar conscientemente qué compartir: son datos QA y no activos web del producto. |
| Fuera del cambio funcional | `CFA-backend-modulo-8-finalizado.zip`, `respaldos/**` (ZIP y copia .bak de código) y `referencias-ui/**`, sin seguimiento. No agregarlos indiscriminadamente ni considerarlos código actual. No se abrieron/restauraron esos respaldos. |

`node_modules`, `dist`, `.angular`, `tmp`, bin/obj están ignorados y no figuran entre los candidatos de frontend. No usar `git add .` sin seleccionar/revisar archivos. Este informe no autorizó ni realizó commits o publicación.

## Limitaciones para explicar en la sustentación

1. **Sesión:** sessionStorage es accesible a JavaScript/XSS; logout local por pestaña no revoca copias del JWT. Sin refresh, `/me`, recuperación por correo ni cierre global porque la API no los ofrece. Exp lo decide el servidor; se aprobaron 30 minutos reales, sin renovación.
2. **Escalabilidad:** áreas, usuarios y algunas listas financieras reciben listas completas y paginan localmente. O5/O6 prueban fronteras funcionales, no rendimiento general ni alta disponibilidad. No se acreditó una matriz exhaustiva de navegadores, accesibilidad, pentest o despliegue multiinstancia.
3. **Precisión del Excel, backend:** se observó `9999999999999999.99` exportado como `1E+16`. La pantalla conserva el decimal exacto; no se afirma que el archivo extremo esté corregido. Los 10000 registros ordinarios de O6 sí se cotejaron. Requiere revisión autorizada del generador del servidor si ese rango será admitido en uso real.
4. **Error conocido del backend:** un área positiva inexistente en reportes provocó error al registrar bitácora. El frontend lo mitiga con catálogo real; las peticiones directas aún conservan esa limitación. No se ocultó ni corrigió en esta revisión.
5. **Alcance API:** historial/bitácora solo lectura; reglas predefinidas, sin IA ni edición/catálogo de parámetros vigentes. Worker puede adelantarse a una detección manual; cero nuevas alertas no significa cero anomalías. Alcance JefeArea/Auditor y combinaciones se conserva por operación; Administrador solo no obtiene acceso financiero.
6. **Sin capacidades inventadas:** no eliminación de documentos/registros/historial, reapertura/prioridades/notificaciones de alertas ni descarga de originales/plantillas donde no hay endpoint. La diferencia de ingresos/egresos no es presupuesto/saldo disponible; la API no declara moneda.
7. **Datos de validación:** los 10001 registros QA de O6 y sus evidencias permanecen, área/cuenta nueva inactivas. La temporal O3 conserva sus cuentas propias y base; no se borró. Esta revisión no comprobó otra vez su estado actual ni realizó limpieza adicional.

## Bloqueos y condiciones antes de despliegue institucional

- **Ciclo de vida:** a fecha 12/11/2026, **.NET 9 está fuera de soporte desde 10/11/2026**, incluyendo ASP.NET Core y EF Core según la [política oficial de Microsoft](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core). Es un pendiente real de plataforma para despliegue mantenido; una actualización requiere alcance/autorización y regresión propios. No se migró el stack durante el cierre académico.
- **Alojamiento no validado:** configurar y comprobar certificado válido, `/api` al backend correcto, rutas profundas SPA/fallback, cabeceras y políticas de seguridad, identidad/permisos SQL y operación/recuperación. Ni `ng serve` ni esta compilación certifican esos elementos.
- **Configuración del servidor:** appsettings.json base apunta a **ControlFinancieroDB**, mientras JWT y credenciales de AdminInicial no están en ese archivo. Deben suministrarse externamente con destino explícito y secretos adecuados; user-secrets de desarrollo no acredita el arranque Production. No iniciar el backend con valores por defecto para una prueba. La compilación no toca esa base.
- **Dependencias/seguridad:** no se realizó auditoría actualizada de CVE ni hardening/pentest integral. `--no-restore` no es un chequeo de vulnerabilidades. Mantener el lockfile y revisar versiones/avisos antes de publicar.
- **Gobierno de entrega:** revisar/seleccionar pendientes Git, proteger respaldos y evidencias, y acordar el tratamiento de los límites conocidos del servidor. No hay versión final confirmada en Git ni despliegue realizado por esta revisión.

**Estado:** proyecto de titulación funcional y verificable para sustentación dentro del alcance aprobado, con nueve módulos y O1–O10 cerrados más suspensión real. Compilaciones y suite automatizada finales aprobadas. **No se certifica listo para producción.**
