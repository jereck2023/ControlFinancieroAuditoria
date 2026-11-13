# CFA · Frontend institucional

Implementación de los módulos 1–9: base Angular, autenticación, administración de áreas/usuarios, registros/documentos financieros con importación/exportación Excel, historial de auditoría, bitácora, reportes, detección de anomalías mediante reglas predefinidas y gestión de alertas. El código del frontend se encuentra en este directorio. La única corrección funcional autorizada en backend fue mover el registro de bitácora dentro de `UsuariosController.DesactivarUsuario` durante el cierre de O3. No se modificaron migraciones ni esquema. Las pruebas reales utilizaron los entornos de pruebas autorizados, incluida la base temporal independiente de O3.

**Cierre técnico del 12/11/2026:** los nueve módulos y las pruebas funcionales O1–O10, más la suspensión real de Windows, están aprobados. La revisión final ejecutó **143 pruebas automatizadas en 32 archivos**, compilación Angular de producción y compilación Release del backend con la corrección O3. Consulte el [informe técnico final](docs/revision-tecnica-final.md) y el [plan consolidado](docs/plan-validacion-integral.md). Las cifras y pendientes en los informes por entrega que siguen son históricos; O3 y el umbral real de O6 se cerraron posteriormente. Este cierre académico no certifica un despliegue de producción.

## Requisitos y ejecución

- Node.js 22.23.3 y npm 10.9.9; Angular/CLI 22, TypeScript 6.0.x y Bootstrap 5.3.x locales.
- Desde PowerShell, dentro de `C:\Proyectos\CFA\frontend`:

```powershell
npm.cmd ci
npm.cmd start
```

Abrir http://localhost:4200. Para verificar:

```powershell
npm.cmd test
npm.cmd run build
```

`npm.cmd test` ejecuta Vitest sin modo observación. La salida de producción queda en `dist/cfa/browser`; debe servirse mediante HTTP(S), no abriendo el HTML con `file://`.

## Conexión con el backend existente

La aplicación utiliza rutas relativas `/api`. `proxy.conf.json` dirige exclusivamente `/api/**` a `https://localhost:7202`, el perfil HTTPS existente del backend. Para aceptar su certificado autofirmado durante el desarrollo local, este proxy utiliza `secure: false`: mantiene el transporte HTTPS y omite la validación del certificado únicamente en esta conexión local. El backend debe estar ejecutándose previamente; el frontend no lo inicia. Reinicie `npm.cmd start` después de cambiar la configuración del proxy.

Esta excepción no debe apuntar a servidores remotos ni utilizarse en producción. No se usa `NODE_TLS_REJECT_UNAUTHORIZED`, no se altera el almacén de certificados ni se desactiva TLS globalmente. Ninguna clave o certificado privado se incluye en este repositorio.

Para producción, servir el frontend y `/api` bajo el mismo origen HTTPS. El proxy de Angular es solo de desarrollo. El servidor web debe resolver rutas de Angular con fallback a `index.html`, preservando las rutas reales `/api`.

## Funcionalidades

- Login, persistencia del JWT tras F5, expiración real según `exp`, logout local y cambio de contraseña obligatorio o voluntario.
- Guards de sesión/permiso, menús por acceso, 401 y 403 diferenciados y mensajes de validación del servidor.
- Áreas: consulta autenticada, búsqueda y paginación local. Administrador: creación, edición y activar/desactivar.
- Usuarios (Administrador): listado, filtros locales, alta, edición, roles múltiples, activar/desactivar y restablecimiento de contraseña. Protección visual del último administrador, respaldada por el servidor.
- Documentos y registros: consulta por permisos, filtros y paginación local, detalles, formularios individuales y control de concurrencia RowVersion.
- Importación Excel: validación del servidor, vista previa de solo lectura, errores por fila y confirmación del mismo archivo/hash. Exportaciones exclusivamente desde la API.
- Historial de auditoría: consultas y detalle de valores anteriores/nuevos, identificación del usuario y fechas UTC. Importes históricos preservados sin redondeo de JavaScript.
- Bitácora de actividades: consultas y detalle de actividad, resultado, referencias, IP y descripción. Ambos módulos utilizan filtros y paginación del servidor y son de solo lectura.
- Reportes: Resumen Financiero y Detalle Financiero por período, operación, área autorizada y documento o solo sin documento; agrupaciones y paginación del servidor; exportación Excel de todos los resultados filtrados mediante la API. La diferencia es ingresos menos egresos, no saldo disponible ni presupuesto restante.
- Detección de anomalías (Auditor): ejecución manual global, mensaje y contador real de alertas nuevas, estados de carga/error y explicación de las tres reglas implementadas. No hay catálogo de parámetros vigente en la API; la explicación no representa su configuración activa.
- Gestión de alertas: filtros y paginación del servidor, detalle y evidencias, revisión y cierre justificado como Resuelta/Descartada, confirmación y RowVersion. Auditor global y JefeArea limitado a alertas financieras de su área activa, sin LOGIN_FALLIDO_REITERADO. El resultado de detección enlaza al seguimiento, sin mezclar ambas operaciones.
- Diseño institucional responsive con Bootstrap y SCSS centralizado; tablas de consulta y formularios individuales, sin hojas de cálculo.

## Seguridad y alcance

Solo se guarda el JWT en `sessionStorage`; no hay contraseñas persistidas. El token dura actualmente 30 minutos según la configuración local revisada; la aplicación siempre utiliza el `exp` recibido, no una duración fija. No hay refresh token ni recuperación por correo. El logout es local y NO revoca el JWT en el servidor.

`sessionStorage` continúa expuesto a XSS. Se usa interpolación segura, no HTML dinámico, recursos locales y CSP de scripts generada en producción. El entorno institucional también debe usar HTTPS y cabeceras de seguridad adecuadas. El reloj del equipo influye en la comprobación anticipada del cliente; el servidor sigue siendo la autoridad.

Para validar roles combinados, no se elige un “rol activo”. Los permisos se evalúan por operación; Administrador no tiene acceso financiero global por defecto. En historial y bitácora, Auditor tiene alcance global; JefeArea requiere área activa y queda limitado a ella. La combinación Administrador + JefeArea sin Auditor es rechazada para historial/bitácora, pero sí puede generar reportes y gestionar alertas financieras de su área activa: son reglas distintas de sus controladores. Auditor tiene reportes y alertas globales, también en combinaciones. La ejecución de detección requiere Auditor en cualquier combinación; Administrador y JefeArea por sí solos no la obtienen. El servidor vuelve a comprobar la autorización en cada operación.

## Verificación de esta entrega

Las pruebas automatizadas cubren sesión, JWT, permisos, guards, validaciones, login y contratos HTTP usando el controlador de pruebas de Angular. **Las respuestas HTTP de esas pruebas están simuladas únicamente en archivos de pruebas; no son pruebas contra SQL Server ni contra la API real.**

Se revisó el login real del frontend en navegador, incluidos validación vacía, ruta protegida sin sesión y ancho móvil de 390 px. No hay datos de demostración en producción.

En la comprobación inicial la API no estaba disponible. En la revisión posterior se corrigió el proxy y se ejecutaron pruebas reales de login, consulta de áreas/usuarios, navegación administrativa, F5 y logout. Antes del login se comprobó, mediante las sesiones SQL del proceso activo de la API, que su conexión era a `ControlFinancieroDB_Pruebas`. No se crearon, editaron ni cambiaron de estado usuarios o áreas. Las credenciales y el JWT no se incluyen en archivos o pruebas. El detalle y las limitaciones están en `docs/integration.md`.

Consulte `docs/architecture.md` para decisiones, contratos, permisos y limitaciones de seguridad.

La validación adicional de escrituras, roles combinados y restricciones de los módulos 1–3 está en `docs/validation-modules-1-3.md`. Registra 120 comprobaciones reales aprobadas, 61 pruebas automatizadas aprobadas, limpieza de datos propios y el caso del último administrador que no se forzó en vivo para preservar las cuentas existentes.

El módulo 4 y su validación están en `docs/module-4.md`: 116 comprobaciones reales aprobadas, pruebas de navegador y 83 pruebas automatizadas aprobadas en la suite ampliada. La lectura exacta de importes requiere un navegador moderno con soporte de `JSON.parse` reviver `context.source`. Los archivos de datos para la prueba manual se generan únicamente dentro de `tmp` (ignorado por Git); no se guardan credenciales ni tokens.

Los módulos 5–6 están documentados en `docs/modules-5-6.md`: 130 comprobaciones reales aprobadas, revisión de navegador y 97 pruebas automatizadas aprobadas en la suite completa. La compilación de producción también fue exitosa. Las cifras de entregas anteriores se conservan como resultados históricos.

El módulo 7 está en `docs/module-7.md`: 207 comprobaciones reales aprobadas, 112 pruebas automatizadas aprobadas y compilación final exitosa. Se documentaron y mitigaron en la interfaz el error de área inexistente y la pérdida de precisión de importes extremos en el Excel generado por el backend; esta última sigue siendo una limitación del archivo exportado. No se forzó en vivo el umbral de más de 10000 operaciones.

El módulo 8 está en `docs/module-8.md`: 126 pruebas automatizadas aprobadas, 37 comprobaciones reales API/SQL aprobadas, validación en navegador y compilación final exitosa de esa entrega. Se detectaron realmente cambios reiterados, contraseñas incorrectas reiteradas y un login fuera de horario con datos QA propios. No hay endpoints para consultar parámetros vigentes. Su enlace al seguimiento se incorporó con el módulo 9, documentado en `docs/module-9.md`.

El módulo 9 está en `docs/module-9.md`: **142 pruebas automatizadas aprobadas**, **174 comprobaciones reales API/SQL aprobadas**, revisión de navegador con conflictos entre dos vistas y compilación final exitosa. Se verificaron cierres Resuelta/Descartada, versiones anteriores, permisos de las 15 combinaciones no vacías, restricciones de seguridad de JefeArea y trazabilidad. Cuentas y áreas QA desactivadas; registros y alertas conservados. Se completaron los nueve módulos funcionales dentro del alcance y las limitaciones documentadas de la API.
