# Validación adicional de módulos 1, 2 y 3

Fecha: 11 de noviembre de 2026. Complementa la integración inicial de `integration.md`; no sustituye pruebas reales por compilación.

## Entorno y aislamiento

Se volvió a identificar el proceso de la API en el puerto 7202 y se consultaron sus sesiones SQL: exclusivamente `ControlFinancieroDB_Pruebas`. El validador vuelve a comprobar la conexión antes de las escrituras y restringe las modificaciones administrativas a IDs creados por la ejecución. No se cambió el backend ni se ejecutaron escrituras SQL directas.

Se añadieron `scripts/validate-modules-1-3.mjs` y pruebas unitarias de protección visual del último administrador. El script manual recibe la credencial por stdin sin eco, genera las contraseñas de prueba en memoria y no imprime tokens ni contraseñas. No se debe incluir ninguna credencial en sus argumentos. Requiere la API y Angular activos y acceso de lectura a las vistas de sesiones SQL para la verificación del entorno.

## Resultados reales contra la API

La ejecución completa `QA_M123_20261111092205` terminó con **120 comprobaciones aprobadas** (incluye comprobaciones de estado/claims y limpieza, no son 120 escenarios independientes).

- Áreas: creación, edición y consulta de persistencia, desactivación y reactivación. Rechazo de duplicados, nombre vacío, longitud excesiva y desactivación repetida.
- Usuarios: creación y edición de nombre de usuario, nombre completo y área; consulta de persistencia, desactivación, reactivación y rechazo del login/token de una cuenta inactiva.
- Validaciones: duplicados, roles vacíos o desconocidos, alta en área inactiva, Auditor sin área, activación con área inactiva y restablecimiento de contraseña de cuenta inactiva.
- Autenticación: bloqueo de acceso mientras debe cambiar contraseña, cambio de contraseña de la cuenta propia de pruebas, invalidación del token anterior y de tokens tras cambiar nombre/área o desactivar la cuenta.
- Restablecimiento administrativo de contraseña de la cuenta propia de pruebas: invalidación del token, exigencia de nuevo cambio y finalización del cambio obligatorio.
- Administrador exclusivo sin área: alta admitida. Al combinar roles sin área: rechazo; después de asignar un área: asignación múltiple admitida.
- **15 combinaciones no vacías de los cuatro roles oficiales:** asignación y claims comprobados; consulta de áreas admitida; listado de usuarios y edición de área permitidos únicamente si la combinación incluye Administrador. Todas las escrituras se dirigieron a registros propios. Esta matriz solo acredita permisos de los módulos 1–3; no valida módulos financieros o de auditoría aún no implementados en el frontend.

## Prueba real en Angular

Se creó el área `QA_M123_UI_20261111_1794389079320` desde el formulario, se renombró con sufijo `_EDITADA`, se desactivó, se reactivó y finalmente se dejó inactiva. Se utilizaron las confirmaciones reales de Angular y se comprobó el estado retornado en el listado. Se cerró la sesión de pruebas al terminar.

Las escrituras de usuarios y contraseñas de esta entrega se comprobaron mediante peticiones HTTP reales al proxy y a la API; no se presenta esa comprobación como ejecución visual de todos los formularios de usuarios. Los formularios y guards también tienen pruebas automatizadas con HTTP simulado.

## Incidencia del validador y limpieza

Una ejecución preliminar creó dos áreas (7 y 8) y un usuario (1009), y aprobó 19 comprobaciones antes de que el guard del propio validador confundiera la clave `usuarios` con `users`. La operación quedó bloqueada antes de enviarse. Se corrigió exclusivamente el script del frontend y se ejecutó la limpieza sobre ese prefijo; sus tres registros quedaron inactivos.

La ejecución completa creó áreas 9 y 10 y usuarios 1010 y 1011. La limpieza por API desactivó los cuatro registros. El área visual 11 también quedó inactiva. No se eliminaron registros: quedan identificables para auditoría en la base de pruebas. No se encontraron errores funcionales de la aplicación durante los casos ejecutados.

La consulta SQL final de solo lectura confirmó las cinco áreas y los tres usuarios inactivos, los administradores existentes 1, 2 y 3 activos y la API conectada exclusivamente a la base de pruebas.

## Último administrador: límite explícito

Había tres administradores activos existentes (IDs 1, 2 y 3). No se alteraron esas cuentas para forzar el escenario de último administrador. Se revisó en el backend la protección de desactivación y retirada del rol y se añadieron pruebas unitarias de la interfaz: desactivación deshabilitada cuando solo queda un administrador activo, y habilitada si existe otro administrador activo, también con roles combinados.

**No se ejecutó el rechazo real 409 del último administrador.** Para validarlo en vivo hace falta un entorno de pruebas aislado que ya tenga un único administrador de pruebas, o autorización específica para preparar ese escenario. No se declara aprobado ese caso por la revisión de código ni por las pruebas simuladas.

Tampoco se esperó la expiración natural de 30 minutos ni se ejecutaron carreras concurrentes entre administradores. Las pruebas iniciales ya aprobadas de F5 y logout no se repitieron como casos de aceptación; solo se inició/cerró sesión para preparar y finalizar las operaciones nuevas.

## Comprobaciones finales

- `npm.cmd test`: **61 pruebas aprobadas en 11 archivos**. Son pruebas automatizadas con HTTP simulado, separadas de las 120 comprobaciones reales del validador manual.
- `npm.cmd run build`: compilación de producción aprobada, sin cambios de configuración de producción.
- `node --check scripts/validate-modules-1-3.mjs`: sintaxis aprobada.
- Formato Prettier y comprobación Git de espacios: aprobados.
- Directorio backend: sin cambios según Git. No se añadieron credenciales ni tokens reales a archivos.
