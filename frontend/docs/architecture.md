# Decisiones de arquitectura

## Alcance de esta entrega

Angular 22 standalone, Router con carga diferida, HttpClient, formularios reactivos y TypeScript estricto (incluidas plantillas). Se implementan los nueve módulos: autenticación, áreas, usuarios, gestión financiera, historial, bitácora, reportes, detección por reglas y gestión de alertas. El inicio ofrece accesos reales; no contiene métricas inventadas ni enlaces a módulos sin implementar. Los contratos y validaciones de cada entrega se documentan también en `module-4.md`, `modules-5-6.md`, `module-7.md`, `module-8.md` y `module-9.md`.

- `core/auth`: decodificación de claims para presentación, sesión, guards y políticas de las operaciones implementadas.
- `core/http`: interceptor limitado al origen y prefijo de nuestra API; extracción segura de mensajes de error.
- `layout`: estructura institucional y navegación responsive.
- `shared`: encabezados, mensajes accesibles, paginación, confirmación modal nativa y errores de campos.
- `features`: pantallas y servicios tipados por recurso; contratos `models/requests` y `models/responses` separados. Las validaciones de asignación de área se mantienen en usuarios.
- `styles`: variables de identidad y estilos compartidos sobre Bootstrap 5.3 local. Fuentes del sistema, logotipo SVG local; sin CDN ni JavaScript Bootstrap.

Los servicios realizan las llamadas HTTP. Las páginas coordinan formularios, carga y navegación; no construyen solicitudes HTTP directamente. Los componentes pequeños conservan las plantillas breves junto a su clase; las páginas separan HTML y TypeScript. No hay CRUD genérico, store global de datos, herencia de componentes ni tablas configuradas mediante grandes esquemas.

## Contratos y paginación

Las propiedades corresponden al JSON de los DTO y respuestas anónimas del backend. No se presume que todas las mutaciones devuelven el usuario completo. Las áreas se buscan a partir de `GET /api/areas`, porque no existe `GET /api/areas/{id}`.

Áreas y usuarios devuelven listas completas: búsqueda y paginación de 10 filas se realizan localmente sobre esas respuestas autorizadas. No se añaden parámetros que el servidor no reconoce. Esta decisión no sustituye la paginación del servidor si el volumen crece.

Historial, bitácora y reportes utilizan filtros y paginación del servidor. En reportes no se consulta automáticamente al abrir la página: el usuario genera un resultado con un período obligatorio. La consulta aplicada se conserva separada del formulario; cambiar un campo no altera silenciosamente una exportación ni una página del resultado anterior. Las exportaciones provienen de la API y abarcan todos los resultados filtrados. Las consultas GET de reportes también generan bitácora en el servidor.

La detección utiliza un servicio POST independiente y respuesta tipada de mensaje/contador. No usa `QueryState` de consultas ni reintentos automáticos, porque produce efectos en el servidor. El resultado es local a la página y no se persiste. La referencia de reglas es documentación de la lógica revisada, sin presentar parámetros de migraciones como datos vigentes. Su resultado enlaza a alertas sin mezclar la ejecución con la gestión de estados.

Alertas tiene consulta paginada, detalle inline y acciones confirmadas con versión del servidor. El detalle se conserva mientras se recarga para mantener la justificación escrita sobre la misma alerta, pero bloquea acciones hasta obtener una versión válida. Después de un 409 se consulta y se exige confirmación de nuevo; no se reintenta automáticamente una escritura. Las respuestas de acceso denegado eliminan los datos protegidos. Los enlaces a trazabilidad se evalúan con sus propios permisos, que no se heredan del permiso de alertas.

## Permisos administrativos

Consulta de áreas: cualquier usuario autenticado que haya completado el cambio obligatorio. Mantenimiento de áreas y todas las operaciones de usuarios: requiere `Administrador`, también cuando se combina con otros roles. No se infiere acceso a módulos financieros o de auditoría.

Se admite selección múltiple de los cuatro roles oficiales. Solo `Administrador` exclusivo permite área nula. Crear/editar exige área activa si se asigna. Cambiar roles requiere primero asignar área cuando corresponda; se respeta la separación de los endpoints, sin presentar dos escrituras como una transacción.

La interfaz evita desactivar al último administrador activo según el listado cargado; el servidor sigue siendo quien resuelve concurrencia y protege definitivamente esa condición. Los errores 409/400 se muestran sin simular éxito. No hay eliminación de usuarios, edición directa de `DebeCambiarPassword` ni gestión de definiciones de roles.

## Sesión y limitaciones aceptadas

Se almacena exclusivamente el JWT en `sessionStorage`, bajo `cfa.access-token`. Identidad y roles se reconstruyen desde los claims al recargar; nunca se almacenan contraseñas ni datos financieros. La lectura de claims no verifica la firma ni acredita permisos: la API valida el JWT y sus reglas en cada petición.

La configuración local revisada emite tokens de 30 minutos. El frontend NO fija una duración propia: usa `exp` del token, en segundos UTC, sin tolerancia añadida. Revisa la vigencia al inicializar, antes de peticiones autenticadas, en navegación, al volver a la pestaña y mediante un temporizador. Una diferencia de reloj del equipo puede adelantar el cierre local; el servidor conserva la decisión final y un 401 también finaliza la sesión. F5 no extiende su duración.

No hay renovación, login automático, recuperación por correo, `/me`, ni endpoint de logout. Cerrar sesión elimina el JWT local, vacía la identidad y navega fuera de las vistas de datos. NO revoca una copia del token en el servidor. Un token sustraído podría utilizarse hasta expirar o ser invalidado por los controles existentes (usuario activo y SecurityStamp).

`sessionStorage` es accesible a JavaScript: un XSS puede robar el token. La memoria no elimina este riesgo al conservar también una copia en almacenamiento. El navegador puede conservar/restaurar sesiones o copiar inicialmente su almacenamiento al duplicar una pestaña; cerrar una pestaña no es una revocación. El logout actúa sobre la sesión de la pestaña actual. No se promete cierre global entre pestañas.

Los 401 de peticiones autenticadas limpian la sesión. Un 401 de login muestra el error de credenciales/bloqueo. Un 403 ordinario muestra falta de autorización sin logout; el mensaje específico del middleware de cambio obligatorio dirige al formulario correspondiente. Un error tardío de un token anterior no elimina una sesión nueva.

Cambiar la contraseña propia exige nuevo login. Cambios propios en nombre de usuario, área, roles o estado que invalidan SecurityStamp también cierran la sesión local. Se informa del efecto antes de acciones administrativas sensibles.

## XSS y publicación institucional

El proxy de desarrollo acepta el certificado autofirmado únicamente en su destino fijo `https://localhost:7202` mediante `secure: false`. Esta excepción es local: no configura el despliegue de producción ni modifica la validación TLS global. No debe reutilizarse para destinos remotos.

Datos y errores se presentan como texto por interpolación Angular, sin `innerHTML`, `eval`, sanitización desactivada ni código construido desde datos de la API. No se adjunta el JWT a recursos externos ni se envía por URLs o consola. La compilación de producción activa la CSP automática de Angular para scripts, sin `unsafe-eval`. Esto es una defensa adicional, no una garantía contra XSS.

El alojamiento debe servir por HTTPS, separar correctamente `/api` de las rutas SPA, aplicar fallback a `index.html` y complementar las cabeceras de seguridad (CSP de estilos/conexiones acorde con Angular, `frame-ancestors`, `X-Content-Type-Options`, etc.). La CSP generada no sustituye la configuración y verificación del servidor web institucional. No se instala ni configura infraestructura en esta entrega.

## Dependencias y presupuesto

Solo Angular y su runtime, RxJS, tslib y Bootstrap en ejecución. Vitest/jsdom para pruebas y Prettier para mantener formato, incluidos por Angular CLI. Sin biblioteca JWT, grillas, NgRx, iconos remotos o librerías Excel. El lockfile fija las versiones resueltas. El presupuesto inicial de producción es 550 kB de aviso y 750 kB de error, teniendo en cuenta Angular y la hoja completa de Bootstrap; las pantallas se cargan de forma diferida.
