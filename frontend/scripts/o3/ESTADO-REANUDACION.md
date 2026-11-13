# O3 · Corrección verificada y pruebas reales aprobadas

**Actualización vigente: 12/11/2026 Perú, 20:02.** La corrección mínima autorizada de DesactivarUsuario ya fue aplicada y probada. Autodesactivación 200, SecurityStamp cambiado, token previo 401, actividad 49 con actor correcto; protección del último administrador 409 sin persistencia/actividad; cuatro carreras administrativas aprobadas (200/409 o 200/401), con una actividad por carrera y al menos un administrador activo en cada estado SQL observado. Sin HTTP 500 en esta regresión. O3 aprobada en su alcance acordado.

[Informe de corrección y cierre](../../docs/validacion-o3-correccion.md). [Evidencia real](evidencias/20261113003000/reanudacion-20261113010237.json). Base temporal conservada con administradores 1/4 activos y 2/3 inactivos; API PID 15244 detenida. No hubo conexiones ni escrituras a las bases protegidas, modificaciones de esquema o migraciones. Los apartados siguientes son históricos y quedan sustituidos por este resultado.

## Resultado vigente · 12/11/2026 Perú, 19:47

**Todos los escenarios previstos se ejecutaron realmente. O3 NO queda completamente aprobada:** hay un HTTP 500 reproducible del backend en la autodesactivación cuando existe otro administrador activo. No se modificó el backend para corregirlo. Los apartados posteriores conservan el estado histórico anterior a esta ejecución.

Destino exclusivo: **CFA_QA_O3_20261113003000**, SQL Server [servidor SQL local: nombre de equipo omitido], API temporal HTTPS 7293. Las 12 migraciones originales están aplicadas y no quedan pendientes. Se verificaron tablas/columnas mapeadas, dos triggers habilitados de protección, claves foráneas e índices habilitados, dos RowVersion y tres reglas originales. Conexiones del PID/API/login comprobadas antes del seeding y de las escrituras. No se abrieron conexiones a ControlFinancieroDB ni ControlFinancieroDB_Pruebas; solo se consultó metadata de permisos desde la temporal. Login sin sysadmin/db_owner. Los 78 archivos originales y su copia mantienen sus hashes.

| Caso real | Respuestas / evidencia | Resultado |
| --- | --- | --- |
| Desactivar único administrador activo | HTTP 409 específico; usuario 1 conserva estado/rol; sin nueva bitácora administrativa de éxito | Aprobado |
| Retirar Administrador al último activo | HTTP 409 específico; conserva rol; sin nueva bitácora administrativa de éxito | Aprobado |
| Desactivaciones simultáneas de A y B por A | HTTP 500/200; B (2) queda inactivo, A (1) activo; un cierre administrativo registrado | Fallo real: no aprobado |
| Autodesactivación aislada con otro administrador activo | HTTP 500; excepción registrada de forma sanitizada: InvalidOperationException, «No se pudo identificar al administrador responsable.»; estado/roles y bitácora antes/después idénticos | Defecto confirmado; no aprobado |
| Retirada concurrente de roles a A/C por A | HTTP 200/401; un administrador conservado; bitácora **23**, CambioRoles | Aprobado |
| A desactiva C / C retira Administrador a A, simultáneos | HTTP 200/401; un administrador conservado; bitácora **28**, CambioEstadoUsuario | Aprobado |
| A y C se desactivan mutuamente, simultáneos | HTTP 200/401; un administrador conservado; bitácora **33**, CambioEstadoUsuario | Aprobado |

Las solicitudes concurrentes tienen intervalos HTTP solapados registrados; no se forzó un intercalado interno SQL ni se hicieron reintentos automáticos. SQL verificó >=1 administrador activo antes, después de cada respuesta y al terminar cada carrera. Son observaciones de estos casos, no una demostración de todos los intercalados posibles. Las tres carreras aprobadas generaron exactamente una bitácora administrativa de éxito cada una. Un 500 no se contó como rechazo autorizado ni se infirió rollback del código HTTP: se compararon estado y bitácora efectivamente.

La causa del 500 se corroboró con la excepción real y el código original: DesactivarUsuario establece Activo=false antes de RegistrarActividadAdministrativaAsync, que rechaza al responsable inactivo cuando actor y destino son la misma cuenta. La transacción no confirmó ese cambio según las comparaciones SQL. La corrección requiere revisión del backend, fuera de esta autorización. No hay corrección funcional frontend que convierta esa operación en exitosa ni se la ocultó.

Errores menores del arnés corregidos durante esta ejecución: lectura completa del JSON fragmentado de SQL Server (el ExecuteScalar anterior truncaba el catálogo grande), reanudación sin reaplicar migraciones confirmadas y recuperación de credenciales QA descartadas al terminar el proceso. Se creó un único administrador QA de recuperación **3** mediante el seeder de la API original y se recuperó A mediante los endpoints de contraseña; no se editaron hashes/roles por SQL. No se repitieron los dos casos del único administrador ya acreditados. Solo se usaron las cuentas/área de esta temporal.

Estado final SQL: administradores **1 y 3 activos**; **2 inactivo**; área QA **1**. Restablecimiento de baselines mediante API registrado aparte de las carreras. Base/login conservados; API temporal PID **7272** detenida y secretos descartados del proceso. Sin bases reconstruidas/eliminadas ni datos masivos. El código de salida 0 del último arnés significa que terminó su recorrido, **no** que O3 esté aprobada: el JSON registra passed=false/fullyValidated=false.

Evidencias reales:

- [12 migraciones, rechazos 409 y carrera con 500](evidencias/20261113003000/reanudacion-20261113004431.json).
- [Excepción confirmada, tres carreras aprobadas, SQL/bitácora y cierre del proceso](evidencias/20261113003000/reanudacion-20261113004747.json).
- [Primer intento de esta ejecución: migraciones aplicadas y error de lectura JSON del arnés](evidencias/20261113003000/reanudacion-20261113004341.json).

Pendiente para aprobar O3 completamente: corregir el defecto del backend mediante una autorización independiente y repetir únicamente el caso fallido y su regresión pertinente. No repetir ahora los casos aprobados ni ejecutar O6. No hubo nuevas pruebas de navegador ni suite/compilación Angular; sí compilación correcta del arnés, con la advertencia NU1900 ya documentada.

---

## Estado histórico anterior a la ejecución final

Fecha: 12/11/2026, Perú (verificación UTC 13/11/2026 00:40:49).

Se modificó únicamente Program.cs y se generaron artefactos/evidencia dentro de frontend/scripts/o3. No se editaron los documentos anteriores: esta autorización limita los cambios a esta carpeta.

## Cambios del arnés

- Destino fijo CFA_QA_O3_20261113003000. Eliminada la creación de otra base y las conexiones a master/las bases protegidas. Las comprobaciones de permisos sobre otros destinos son solo metadatos consultados desde la temporal; no intentan abrir esas bases.
- Reemplazado el ejecutor del script idempotente por IMigrator.MigrateAsync con la última migración original como destino. Sin modificaciones de ApplicationDbContext, migraciones, configuración ni fuentes originales/copias del backend.
- Antes de migrar: inventario de las 12 migraciones, historial aplicado/pendiente, comprobación de los residuos documentados y hashes de los 78 archivos originales/copia. Si difiere la condición inicial documentada, detenerse sin reconstruir.
- Después de migrar: igualdad de las 12 entradas del historial, cero pendientes, tablas/columnas mapeadas, triggers habilitados, claves foráneas e índices habilitados, RowVersion y reglas originales. Estos controles están implementados, **todavía no ejecutados**.
- Corregida la renovación de la sesión QA de preparación tras asignar área: ese cambio invalida el SecurityStamp según el backend; no reutilizar el token anterior. No modifica la estrategia funcional de autenticación.
- Las evidencias futuras se escriben en scripts/o3/evidencias, sin sobrescribir el resultado anterior conservado en docs.

## Detención de esta ejecución

La primera compilación detectó CS0136 por dos variables locales con nombres repetidos. Se corrigieron los nombres y la segunda compilación terminó con **0 errores**. Conserva NU1900, advertencia de consulta de vulnerabilidades de NuGet no disponible en los activos existentes. No se restauraron paquetes ni recompiló el proyecto original del backend.

Como el usuario exigió detenerse antes de pruebas ante cualquier error de preparación, **no se lanzó el arnés, no se invocó MigrateAsync ni se inició la API aislada**. No se intentó aplicar otra vez el SQL idempotente. No se realizaron escrituras SQL.

La consulta de solo lectura posterior confirmó la base temporal en [servidor SQL local: nombre de equipo omitido], la tabla __EFMigrationsHistory, ausencia del login temporal previsto y cero sesiones del proceso API. No se confirma la aplicación de las 12 migraciones. El primer intento de esta consulta tuvo opciones incompatibles de sqlcmd (-h con -y 0) y no llegó a conectarse; se corrigió la invocación y se obtuvo la lectura real con -y 4000.

Evidencia: [preflight-sin-ejecucion.json](evidencias/20261113003000/preflight-sin-ejecucion.json).

**O3 no aprobada.** Permanecen pendientes la ejecución de migraciones, comprobación completa del esquema, provisión del login restringido/API/fixtures y todos los casos de último administrador/concurrencia/bitácora. No se repitieron pruebas aprobadas ni se ejecutó O6. La base temporal se conserva; no se reconstruyó ni eliminó.

Comando del arnés preparado, **no ejecutado en esta reanudación**:

```powershell
dotnet C:\Proyectos\CFA\frontend\scripts\o3\bin\Release\net9.0\O3.dll C:\Proyectos\CFA\frontend 20261113003000
```
