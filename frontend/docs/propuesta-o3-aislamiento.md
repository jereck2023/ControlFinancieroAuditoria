# O3 · Preparación aislada pendiente de aprobación

Fecha: 12/11/2026. **Solo propuesta: no se creó ninguna base, login, proceso API ni fixture de O3; no se ejecutaron sus pruebas.** Sustituye la condición antigua de conservar el nombre `ControlFinancieroDB_Pruebas` en otra instancia. La autorización actual permite una base temporal independiente. O6 y las pruebas aprobadas quedan fuera de este trabajo.

## 1. Destino y separación

Propongo una base nueva `CFA_QA_O3_<marcaUTC>` en el SQL Server 2022 existente, sin copiar/restaurar datos de ninguna base actual. Consulta de metadatos realizada: servidor `[servidor SQL local: nombre de equipo omitido]`, versión `16.0.1000.6`, autenticación mixta habilitada. No se consultaron ni modificaron administradores existentes. LocalDB disponible es 2019; no se usará como sustituto de SQL Server 2022.

- Login SQL nuevo `cfa_o3_<marcaUTC>`, sin roles de servidor ni permisos explícitos sobre otras bases; usuario y permisos únicamente en la temporal. El operador Windows crea la base y aplica su esquema; la API usa el login restringido, nunca la identidad privilegiada del operador. No habilitar modos de autenticación ni cambiar permisos de las bases protegidas.
- Antes de iniciar la API, verificar que ese login puede entrar en la temporal y **no puede abrir** `ControlFinancieroDB` ni `ControlFinancieroDB_Pruebas`. Si hereda algún acceso, detener la preparación; no modificar esas bases para corregirlo.
- API independiente en `https://localhost:7293`, solo si el puerto está libre. Configuración externa exclusivamente del proceso: conexión temporal, administrador inicial QA y clave/emisor/audiencia JWT propios. Nunca usar la configuración base que apunta a la principal. Conservar duración JWT y lógica originales.
- Angular independiente en `http://localhost:4293`, con proxy temporal hacia 7293. No cambiar el proxy habitual, producción ni las instancias 4200/7202. La excepción de certificado, si hace falta, queda restringida a ese destino HTTPS local.
- Verificación previa a cada escritura: nombre exacto y servidor permitidos, PID/puerto de la API aislada y conexión SQL efectiva de ese proceso; abortar si no es demostrable. Registrar esta identidad sin contraseña. El nombre no se aceptará por coincidencia de prefijo solamente: debe coincidir con el manifiesto de la ejecución.

El aislamiento es de **base, credenciales y procesos**, no de máquina/servicio SQL. No requiere instalar otra instancia. Si no se puede obtener esa separación efectiva, O3 seguirá pendiente.

## 2. Esquema y datos mínimos

La API no aplica migraciones al arrancar. Hace falta el esquema completo de las migraciones existentes, incluida `20261111005207_AgregarGestionAlertas`, sus restricciones, triggers y los tres registros de reglas predefinidas. No crear ni editar migraciones. El worker se registra siempre: seguirá funcionando únicamente sobre la base temporal; no cambiar reglas para silenciarlo.

El seeder crea cuatro roles y el administrador indicado por `AdminInicial:Username/Password`, activo y con cambio obligatorio. Preparación mínima:

1. Administrador **A** nuevo del seeder; completar el cambio obligatorio por API/formulario.
2. Una única área QA activa y asignarla a A con el DTO de actualización real. Es necesaria para que retirar Administrador y dejar `PersonalArea` sea una petición válida, no un rechazo por falta de área.
3. Para el caso de un administrador, verificar que A es el **único** administrador activo. Después de esos rechazos, crear **B**, también QA/Administrador con la misma área, y completar su cambio obligatorio. No crear Auditor, cuentas financieras ni registros/documentos.
4. Inventariar todos los usuarios/roles. Solo A/B y el área propia pueden modificarse; los roles de catálogo, bitácora y posibles alertas automáticas son parte normal del ambiente vacío inicializado.

Contraseñas, conexión con secreto y JWT solo en memoria; sin archivos, argumentos de proceso, consola, capturas ni evidencias. La configuración de cada proceso se suministrará mediante su diccionario de entorno, sin persistir variables globales ni editar `appsettings`/user-secrets.

## 3. Comandos previstos — NO ejecutados

Ejemplo de nombres; al ejecutar se fijará una marca UTC nueva y se rechazará cualquier destino existente. Rutas auxiliares únicamente dentro de `frontend/tmp/o3/<marcaUTC>` (ignorado por Git). Antes se comprobarán permisos de provisión, espacio y puertos libres; no se instalará ni arrancará nada si falla una condición.

```powershell
# Solo tras aprobación. $work y $qaDb quedarán fijados en el manifiesto QA.
$qaDb = 'CFA_QA_O3_<marcaUTC>'
$work = 'C:\Proyectos\CFA\frontend\tmp\o3\<marcaUTC>'
sqlcmd -S localhost -E -b -Q "CREATE DATABASE [$qaDb];"

# dotnet-ef no está instalado actualmente: herramienta local, no global.
dotnet tool install dotnet-ef --version 9.0.20 --tool-path "$work\tools"

# $copy: copia de trabajo del proyecto bajo $work\source, sin bin/obj,
# appsettings ni launchSettings; fuentes/migraciones idénticas al original.
# No ejecutar build sobre el proyecto original ni reutilizar binarios sin verificar.
dotnet build "$copy\ControlFinanciero.API.csproj" --configuration Release

# Con configuración temporal ya suministrada al entorno del proceso EF.
& "$work\tools\dotnet-ef.exe" migrations script 0 20261111005207_AgregarGestionAlertas --idempotent --no-build --configuration Release --project "$copy\ControlFinanciero.API.csproj" --startup-project "$copy\ControlFinanciero.API.csproj" --output "$work\schema.sql"

# Revisar antes el SQL generado: sin USE/restauraciones/referencias a bases ajenas.
sqlcmd -S localhost -E -d $qaDb -b -i "$work\schema.sql"

# API: ejecutar la DLL de la copia compilada con ProcessStartInfo.Environment.
# Ejecutable/argumento sin secretos: dotnet <copia>\bin\Release\net9.0\ControlFinanciero.API.dll
# Angular: proxy de QA, sin tocar su configuración habitual.
npm.cmd exec -- ng serve --port 4293 --proxy-config "$work\proxy.conf.json"
```

La provisión del login/usuario se realizará mediante un comando SQL en memoria, con secreto aleatorio generado en memoria, sin `-P`, archivo SQL con contraseña ni texto sensible en errores. Operaciones concretas: `CREATE LOGIN`, `CREATE USER ... FOR LOGIN`, permiso `CONNECT` y roles `db_datareader`/`db_datawriter` **solo en la temporal**; no conceder `sysadmin` ni `db_owner` a la API. Verificar acceso al bloqueo `sp_getapplock` usado por el backend; si falta, diagnosticar antes de las pruebas, sin elevar permisos globales.

Variables de entorno **solo de los procesos auxiliares**, incluidas las invocaciones EF: `ConnectionStrings__DefaultConnection`, `AdminInicial__Username`, `AdminInicial__Password`, `Jwt__Key`, `Jwt__Issuer`, `Jwt__Audience`; para API, `ASPNETCORE_URLS=https://localhost:7293`. Usar ambiente Production en el proceso auxiliar para no cargar user-secrets de desarrollo, sin editar ninguna configuración de producción. Los valores secretos se omiten aquí deliberadamente. La ruta de trabajo del proceso también será la copia QA. Revisar dependencias/resolución EF antes de aplicar el esquema; no iniciar una API con tablas incompletas.

La copia solo evita que la compilación genere `bin/obj` en backend: no se propone una versión modificada de su código. Registrar hashes de fuentes/migraciones originales y copia; no copiar archivos de configuración con credenciales. Los comandos de creación son una propuesta revisable, no un script listo para ejecutar sin las verificaciones descritas.

## 4. Casos acotados

| Caso | Operación real | Aceptación |
| --- | --- | --- |
| Único A: desactivar | `PUT /api/usuarios/{A}/desactivar` como A | 409 con mensaje de último administrador; A activo y Administrador, sin cambios persistidos. |
| Único A: retirar rol | `PUT /api/usuarios/{A}/roles`, cuerpo `{"roles":["PersonalArea"]}` | 409 específico; conservar rol y estado. No enviar roles vacíos. |
| Dos activos: desactivación concurrente | Como A, enviar simultáneamente desactivaciones de A y B, sin reintento automático | Una operación válida puede confirmarse; la otra debe impedir llegar a cero (409 o invalidación real de autorización). Corroborar ambas respuestas y persistencia. |
| Dos activos: retirada concurrente | Como A, enviar simultáneamente retirada de Administrador de A y B, manteniendo `PersonalArea` | Misma conservación; comprobar roles, no solo estado activo. |
| Dos actores: operaciones cruzadas | A intenta desactivar B mientras B intenta retirar Administrador de A | Comprobar revalidación de autorización tras el bloqueo e invariante. No considerar una respuesta genérica un rechazo de último administrador. |

Antes de cada carrera se requieren exactamente dos administradores activos, cambios obligatorios completados y sesiones nuevas válidas. Reutilizar solo A/B: después de recoger evidencia, el administrador superviviente puede restaurar por endpoints la condición inicial del otro QA y volver a autenticar ambos; registrar esas operaciones de preparación aparte. Si no puede restaurarse por API o aparece un fallo inesperado, detenerse, sin reparación SQL encubierta.

El código usa transacción Serializable y `sp_getapplock` exclusivo `CFA_Administradores` compartido por las dos operaciones. Vuelve a validar al actor dentro del bloqueo. Por ello una carrera puede rechazar con 401/403 por autorización invalidada, además del 409 de protección. El 503 por timeout del bloqueo existe, pero deja **incompleta** la prueba funcional de esa carrera: diagnosticar y acordar un nuevo intento; no contarlo como aprobación. Un 500 siempre se investiga. No forzar carreras internas cambiando backend ni manteniendo bloqueos SQL artificiales.

## 5. Invariante, evidencia y recuperación

Consulta observadora de solo lectura, conectada explícitamente a la temporal:

```sql
SELECT COUNT(DISTINCT u.Id) AS AdministradoresActivos
FROM dbo.AspNetUsers AS u
JOIN dbo.AspNetUserRoles AS ur ON ur.UserId = u.Id
JOIN dbo.AspNetRoles AS r ON r.Id = ur.RoleId
WHERE u.Activo = 1 AND r.Name = N'Administrador';
```

Conservar inventario de IDs/estado/roles antes, tras cada respuesta y al terminar cada carrera; cotejar bitácora y respuestas con tiempos UTC/identificador de petición. Lecturas normales de datos confirmados, sin `NOLOCK`. El contador debe permanecer >= 1 y concordar con qué operación se confirmó. Nunca inferir rollback solo de un error HTTP. Capturar también tratamiento de 409/invalidez de sesión en Angular, sin repetir formularios ya aprobados.

Las observaciones y la revisión del bloqueo acreditarán los escenarios ejecutados; un muestreo no demuestra todos los intercalados posibles ni una topología multiinstancia. Si se observa cero, se detienen las escrituras inmediatamente y se registra **fallo del backend**, no una corrección ficticia de Angular.

Recuperación: detener únicamente los PID auxiliares registrados, conservar base temporal y evidencia sin secretos y evaluar la persistencia real. Si no hay administrador recuperable por API, no insertar roles ni editar cuentas por SQL: tras acordarlo, crear otra temporal con marca nueva, aplicar el mismo esquema y recrear el mínimo QA. Reiniciar el seeder sobre la misma base **no** repara un usuario existente (retorna sin modificarlo). No restaurar encima de ninguna base compartida.

La eliminación final de base/login queda separada y pendiente de aprobación: cerrar las conexiones propias, validar nombre exacto/ID contra el manifiesto y que no sea ninguna base protegida, conservar evidencia y entonces `DROP DATABASE [nombre_QA_verificado]` / `DROP LOGIN [login_QA_verificado]`. No utilizar `SINGLE_USER WITH ROLLBACK IMMEDIATE`, restauraciones `WITH REPLACE`, borrado de cuentas existentes ni limpieza automática si falla un caso.

**Estado final de esta revisión: O3 pendiente de aprobación de preparación y ejecución; O6 sin ejecutar. No hubo cambios de aplicación, backend, migraciones o datos.**
