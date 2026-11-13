# Verificación inicial de etapas 1–3

Fecha: 11 de noviembre de 2026.

Este documento conserva la verificación inicial. Las pruebas reales posteriores a la corrección del proxy se registran por separado en `integration.md`.

## Automatizada

- `npm.cmd test`: **59 pruebas aprobadas, 10 archivos**, ejecutadas con Vitest y jsdom. En este entorno se ejecutaron fuera del aislamiento porque el proceso aislado no podía acceder de forma consistente a los archivos temporales del runner.
- Cobertura funcional de las pruebas: decodificación de claims, expiración exacta, recuperación desde sessionStorage, limpieza local, navegador con almacenamiento bloqueado, pestaña suspendida, permisos administrativos para las 16 combinaciones de roles, guards, aislamiento del Bearer por origen/ruta, 401/403, errores tardíos de sesiones anteriores, validaciones de contraseña y área, login, alta de usuarios y mensajes de conflicto.
- Se comprueban métodos, rutas y cuerpos de las llamadas administrativas con `HttpTestingController`. No se realizan llamadas a SQL Server.
- Se verifica que una cadena con marcado HTML recibida como nombre de área se renderiza como texto y que Auditor no obtiene acciones administrativas.
- `npm.cmd run build`: compilación de producción correcta, con TypeScript y plantillas estrictas, carga diferida y CSP de scripts generada. El bundle inicial queda dentro del presupuesto declarado.
- Revisión de código: sin `any` explícito, HTML dinámico inseguro, uso de localStorage, logs de credenciales o bibliotecas de hojas de cálculo.

## Navegador

Se verificó el login en el navegador local, su validación al enviar campos vacíos y la redirección a login al abrir `/usuarios` sin sesión. Se revisó una vista móvil de 390 × 844 px: ancho del documento 390 px, sin desbordamiento horizontal.

No se realizaron sesiones autenticadas en navegador, ni validación visual completa de las pantallas administrativas con usuarios reales. Las pruebas de componentes usan datos de prueba exclusivamente en archivos `.spec.ts` y fixtures importados por estos; no hay datos ficticios en la aplicación distribuida.

## API real y base de datos

El intento de conexión sin credenciales a `https://localhost:7202/api/areas` devolvió conexión rechazada. No se inició el backend: su arranque ejecuta inicialización de Identity y tareas de detección que pueden escribir datos. Tampoco se enviaron credenciales ni operaciones administrativas reales.

Por tanto, una compilación y pruebas HTTP simuladas correctas **no acreditan una integración probada con la API real**. Quedan pendientes login con credenciales autorizadas, F5 autenticado, expiración con reloj real, cambio obligatorio, gestión administrativa, invalidación por SecurityStamp y conflictos por cambios simultáneos en un entorno de prueba autorizado.

`git diff --name-only -- backend` y `git status --short -- backend`, ejecutados desde la raíz de CFA, no reportaron cambios. No se ejecutaron migraciones ni comandos de SQL Server.
