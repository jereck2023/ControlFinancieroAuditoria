# Bloque 1 · Permisos de áreas y consulta de usuarios por área

**Implementado y verificado el 14/11/2026, Perú** (evidencias UTC del 15/11, ejecución `QA_PERM_B1_20261115040857`). Sin commits/push, borrados, cambios de entidades/ApplicationDbContext/migraciones/esquema o acceso a la base principal. No se avanzó al Bloque 2.

## Correcciones y contratos

- `AreasController.ObtenerAreas`, **GET /api/areas**: requiere Administrador **o** Auditor. Los endpoints POST/PUT/PATCH conservan Administrador exclusivamente. PersonalArea, JefeArea y PersonalArea + JefeArea no obtienen el directorio; las combinaciones con Auditor o Administrador sí lo obtienen.
- Nuevo `UsuariosAreaController.ListarUsuariosDeMiArea`, **GET /api/usuarios/mi-area**: requiere JefeArea y área activa. El servidor consulta la asignación del solicitante autenticado y filtra en SQL; no acepta un área proporcionada por el cliente. Un área inexistente/inactiva o ausente devuelve 403 comprensible. No agrega operaciones de escritura.
- Nuevo DTO `UsuarioAreaResponse`: únicamente `id`, `userName`, `nombreCompleto`, `activo`, `roles`. No expone hashes, contraseña, SecurityStamp, tokens, bloqueo, datos internos de Identity o estado de cambio de contraseña. Incluye cuentas activas e inactivas de la propia área.
- `UsuariosController` permanece con `[Authorize(Roles="Administrador")]`: listado/detalle global y todas sus mutaciones siguen siendo administrativos. No se cambió ese archivo ni la corrección O3.
- Angular: política read-areas para Administrador/Auditor y read-area-users para JefeArea. Ruta diferida **/usuarios-mi-area**, página `AreaUsers`, respuesta propia tipada y `UsersApi.listMyArea`. Menú e Inicio ofrecen la consulta propia a JefeArea; si además tiene Administrador, mantienen el acceso administrativo global. Su permiso de consulta propia sigue disponible en ruta directa por el rol JefeArea.
- La pantalla reutiliza PageHeader, Feedback, Pagination, estilos institucionales, tabla y filtros locales de nombre/estado. No contiene selector de otras áreas, enlaces de edición, creación, contraseñas, roles o activación. Mensajes nuevos en español, incluido el error de conexión sin términos técnicos.

## Dependencias revisadas

| Consumidor GET /api/areas | Resolución |
| --- | --- |
| Áreas institucionales | Menú y ruta restringidos por read-areas; backend aplica la misma restricción. |
| Formulario/listado administrativo de usuarios | Conservan el catálogo y sus permisos Administrador; no se ampliaron para JefeArea. |
| ReportFilters | Solo solicita áreas cuando existe Auditor; ese acceso sigue permitido. JefeArea (también Administrador + JefeArea sin Auditor) genera reportes propios sin pedir el directorio. |
| Documentos y registros financieros | No consumen AreasApi. No se alteraron sus servicios, contratos ni permisos. |
| Nueva consulta de usuarios propios | Solicita únicamente /usuarios/mi-area; no usa el catálogo de áreas. |

La consulta propia usa dos lecturas para listar usuarios/roles, sin una consulta HTTP o SQL por usuario y sin cambiar el DbContext. Paginación local coherente con la API administrativa actual, no una paginación del servidor inventada.

## Compilación y pruebas automatizadas

- Backend Release: **0 errores y 0 advertencias**, incluyendo ambos controladores y nuevo DTO. No se ejecutó Update-Database ni MigrateAsync.
- Frontend producción: **exit 0**, inicial **523.13 kB**, dentro del presupuesto.
- Suite completa: **150 pruebas aprobadas en 33 archivos**, exit 0. Se ejecutó completa por cambiar políticas compartidas; HTTP de los specs es **simulado**.
- TypeScript `--noEmit --noUnusedLocals --noUnusedParameters`: exit 0.
- Casos nuevos: política acumulativa de las 16 combinaciones (incluido conjunto vacío), guards de áreas y consulta propia, contrato GET sin área elegible, campos de tabla, representación segura de texto, estado vacío/403, filtros y error de conexión comprensible.
- Se corrigió una expectativa inicial del test: la paginación añade botones de navegación además de Actualizar. No fue un fallo funcional; las aserciones comprueban ausencia de acciones administrativas, no un número incorrecto de botones.

## API y SQL reales

Se verificó primero que la instancia habitual 7202 utilizaba exclusivamente **ControlFinancieroDB_Pruebas**. Para probar el nuevo ensamblado sin detener la instancia del usuario se ejecutó la API Release en **HTTPS localhost:7294**, con conexión de proceso explícita a esa misma base y credenciales/JWT solo en memoria. Se comprobaron PID y sesiones SQL antes de solicitudes/escrituras. Los roles y administrador de arranque ya existían; no se modificaron sus cuentas por el seeder. Configuraciones originales intactas.

Se verificaron **145 solicitudes API**, incluidas preparación/limpieza; no representan 145 escenarios funcionales independientes. Entre ellas hubo **55 rechazos 403 esperados**. Ocho casos de roles aprobados:

| Roles | Directorio de áreas | Usuarios propios | Usuarios globales / administración |
| --- | --- | --- | --- |
| PersonalArea | 403 | 403 | 403 |
| JefeArea | 403 | 200 | 403 |
| Auditor | 200, sin mutaciones | 403 | 403 |
| Administrador | 200 y administración | 403 por endpoint propio de JefeArea | 200 y administración |
| JefeArea + Auditor | 200, sin mutaciones | 200 solo su área | 403 |
| Administrador + JefeArea | 200 y administración | 200 solo su área | 200 global |
| Administrador + Auditor | 200 y administración | 403 por endpoint propio de JefeArea | 200 global |
| PersonalArea + JefeArea | 403 | 200 solo su área | 403 |

Para las cuatro combinaciones con JefeArea, SQL y respuesta confirmaron **9 usuarios propios** (incluido un inactivo), excluyendo al usuario QA de otra área. Se comprobó la forma exacta de los campos y que `?areaId=<ajena>&id=<ajeno>` no amplía el alcance. El administrador global sí encontró al usuario de la otra área.

JefeArea, JefeArea + Auditor y PersonalArea + JefeArea intentaron crear/editar/activar/desactivar usuarios, cambiar roles y restablecer contraseñas; todos fueron 403. También se rechazó su acceso al detalle administrativo. Los no administradores intentaron las mutaciones de áreas: 403. SQL corroboró que las cuentas/áreas de creación prohibida no existían. Administrador creó y modificó áreas QA y ejecutó desactivación/reactivación reales.

Se comprobaron documentos y registros con PersonalArea, JefeArea, Auditor, JefeArea + Auditor y Administrador + JefeArea; todos devolvieron 200 según su alcance. Reportes detalle funcionó para JefeArea y combinaciones autorizadas, con filtros propios o QA explícitos. La prueba del área QA desactivada produjo 403 en la consulta propia para JefeArea y JefeArea + Auditor, y después se restauró la precondición. No se crearon documentos ni movimientos financieros para este bloque.

## Navegador real

Angular habitual 4200 a través de un relé local **localhost:4307**: recursos frontend → 4200, llamadas /api → API compilada 7294. Sin modificar proxy.conf.json ni simular respuestas. Se revisaron **seis perfiles**:

- PersonalArea: no aparecen áreas/usuarios; ruta directa /areas redirige a acceso restringido.
- JefeArea: sin menú de áreas; tabla propia con 9 usuarios, cuatro columnas y ningún usuario ajeno o enlace administrativo. /areas y /usuarios/nuevo restringidos.
- Auditor: directorio sin nueva área/edición/activación; el catálogo de área del filtro de reportes carga correctamente.
- Administrador: mantenimiento de áreas disponible y listado global encuentra al usuario QA de la otra área.
- Administrador + JefeArea: conserva menú global y creación de usuarios.
- JefeArea + Auditor: menú de áreas y consulta propia, 9 usuarios, sin creación de usuarios.

Se esperó a completar el login antes de navegar; un intento inicial de automatización navegó antes de resolverlo y no se contó como prueba aprobada. La captura inicial de Inicio no se utilizó como evidencia de la tabla. La captura válida final es `usuarios-mi-area.png`, con encabezado Consulta institucional y la tabla ya cargada. Se cerró sesión al terminar.

## Evidencia, limpieza y pendientes

Datos propios: áreas **2023/2024**, diez usuarios QA del prefijo de ejecución (IDs en resultado.json). **Las diez cuentas y ambas áreas quedaron inactivas**, verificado por SQL. Las cuentas/áreas anteriores no se modificaron. Se conservaron bitácora y datos de prueba; API aislada PID **18136** y relé detenidos, proceso de pruebas finalizado con exit 0. Sin contraseñas o tokens en archivos, capturas o consola.

Evidencias locales ignoradas por Git: `docs/evidencias-permisos-bloque-1/QA_PERM_B1_20261115040857/resultado.json`, `navegador.json` y `usuarios-mi-area.png`. El arnés fuente es `scripts/validate-permissions-block-1.mjs`; no se ejecuta con npm test/build.

**No quedan errores funcionales conocidos de este bloque.** La instancia habitual del backend debe reiniciarse/recompilarse para cargar los cambios: no se reemplazó ni detuvo el proceso del usuario en 7202. Las pruebas reales descritas corresponden al ensamblado corregido en 7294, no se presentan como validación de una instancia antigua sin reiniciar. No se repitieron O1–O10 ni se validaron todos los escenarios de otros módulos o una matriz exhaustiva de navegadores. No se realizaron commits/push. Se espera revisión del usuario antes del Bloque 2.
