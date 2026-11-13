# Integración local con la API

## Corrección

El 11 de noviembre de 2026 se corrigió `proxy.conf.json`: `secure: false` únicamente para el proxy `/api/**` dirigido a `https://localhost:7202`. La conexión continúa siendo HTTPS. La excepción permite el certificado autofirmado de ASP.NET durante el desarrollo local y evita el error `502 Bad Gateway` ocasionado por su rechazo.

No se cambiaron las opciones de producción, la validación TLS global, el backend ni las migraciones. Se reinició solo Angular para cargar el proxy actualizado. No se reinició la API ni SQL Server.

## Comprobación previa de base de datos

Antes de enviar credenciales, se identificó el proceso que escuchaba en el puerto 7202. Se consultó `sys.dm_exec_sessions` en modo de solo lectura, filtrando por `host_process_id` de esa API. Su conexión SQL activa correspondía a `ControlFinancieroDB_Pruebas`; no había sesiones de ese proceso en otra base de datos. La configuración base del proyecto apuntaba a la base principal, por lo que no se utilizó ese archivo como prueba suficiente del entorno en ejecución.

## Pruebas reales realizadas

- Login con la cuenta administrativa de pruebas proporcionada por el usuario: redirección a Inicio y presentación del perfil Administrador.
- Recepción y uso del JWT: la sesión aceptó sus claims y las consultas autenticadas de áreas y usuarios cargaron datos reales desde la API. No se imprimió ni se persistió el token en archivos; su copia persistente de ejecución quedó únicamente en sessionStorage hasta el logout.
- Áreas: listado y resumen cargados desde la API.
- Usuarios: listado y roles cargados desde la API.
- Navegación administrativa: acceso a la pantalla de roles de la cuenta y a los formularios de nueva área y nuevo usuario, sin guardar ni cambiar valores.
- Recarga completa y tecla F5 sobre Usuarios: la sesión se reconstruyó y el listado volvió a cargar sin solicitar credenciales.
- Logout local: regreso al login con los campos vacíos.
- F5 después del logout y navegación directa a `/usuarios`: se mantuvo el login y no se restauró la sesión cerrada.
- Consulta real sin credenciales a `/api/usuarios` a través del proxy de Angular: HTTP 401, sin error TLS ni 502.

Después de las pruebas, una segunda consulta de las sesiones SQL del mismo proceso volvió a mostrar exclusivamente `ControlFinancieroDB_Pruebas`.

Estas pruebas no equivalen a una revocación del JWT en el servidor. No se capturaron pantallas de credenciales o tokens ni se añadieron secretos a código o fixtures.

## Alcance excluido

No se crearon, editaron, desactivaron ni eliminaron usuarios o áreas. No se enviaron cambios de roles ni restablecimientos de contraseña. El login puede generar los registros de autenticación/bitácora normales del backend en la base de pruebas. No se realizaron escrituras en la base principal.

No se probaron en vivo otros roles, cambios obligatorios de contraseña, conflictos administrativos ni la espera de 30 minutos hasta la expiración natural. Las pruebas unitarias cubren expiración y manejo de 401/403 con HTTP simulado; esos resultados se distinguen de las comprobaciones reales anteriores.

## Verificación automatizada posterior

- `npm.cmd run build`: compilación de producción aprobada, sin cambios en la configuración de producción.
- `npm.cmd test`: 59 pruebas aprobadas en 10 archivos; sin utilizar las credenciales reales ni realizar llamadas a la API.
- Comprobación de formato Prettier y `git diff --check`: aprobadas.
- Comprobación Git del directorio backend: sin modificaciones.
