# Entrega e instalación nueva de CFA

Revisión: 17/11/2026. Esta preparación no ejecutó SQL, migraciones ni la aplicación contra ninguna base de datos. No se modificaron las fuentes del backend ni del frontend.

## Archivos de entrega

- `sql/CFA-migraciones-idempotente.sql`: esquema desde cero hasta `20261111005207_AgregarGestionAlertas`, generado con EF Core SQL Server 9.0.20 a partir de las 12 migraciones originales.
- `sql/CFA-migraciones-idempotente.verificacion.json`: inventario, comprobaciones y hashes de las fuentes originales y del SQL.
- `herramientas/GenerarSqlCfa`: generador reproducible que compila las fuentes originales de esquema mediante enlaces; no inicia la API ni el inicializador de usuarios. Un interceptor bloquea cualquier apertura de conexión.
- `revision-entrega.md`: observaciones de Git y comentarios de desarrollo.

El SQL no es un respaldo de datos: contiene estructura, historial técnico de EF y configuración inicial de tres reglas. No contiene cuentas, contraseñas, tokens, áreas QA ni operaciones financieras. Las tablas de Identity conservan sus columnas necesarias, como PasswordHash y AspNetUserTokens, sin valores de credenciales.

## Comprobación del script

Se cotejaron las 12 migraciones compiladas con sus archivos originales y sus operaciones: 14 tablas de aplicación/Identity y la tabla técnica `__EFMigrationsHistory`, 107 columnas de aplicación/Identity, 14 claves primarias más la técnica, 24 relaciones, 29 índices finales (6 únicos), 2 restricciones CHECK, 2 columnas RowVersion, la intercalación Modern_Spanish_CI_AI y los dos triggers de protección de trazabilidad. Se comprobaron guardas y entradas del historial para las 12 migraciones, así como los destinos de las inserciones: únicamente reglas e historial EF.

SHA-256 del SQL: `EAEB9C540BF2B201145B1AF62828C7ADBE57AED745BEFC0D9E3F9AB83047A319`.

La operación SQL original que crea `TR_BitacorasActividades_Proteger` comienza con CREATE TRIGGER. Al quedar dentro del IF de un script idempotente, requiere su propio lote en SQL Server. El generador encapsula exactamente ese cuerpo en `EXEC(N'...')`, escapando las comillas, solo en el archivo de entrega. La migración original y el comportamiento del trigger no cambian. El trigger del historial ya usa SQL dinámico en su migración.

La comprobación es estática y offline: **cero intentos de conexión**. No se ha validado ejecutando el archivo ni repitiendo su ejecución en SQL Server; queda pendiente hacerlo en una base nueva expresamente autorizada. La idempotencia se basa en `__EFMigrationsHistory`: no repara un esquema arbitrario ni objetos eliminados manualmente.

## Instalación nueva: pasos que deberá realizar el responsable

Estos pasos son instrucciones para una instalación posterior; no se ejecutaron durante esta preparación.

1. Disponer de SQL Server 2022 y .NET 9; para compilar, SDK .NET 9 y las herramientas Node indicadas por el frontend. Conservar el repositorio completo, los archivos de proyecto y `frontend/package-lock.json`.
2. Crear y seleccionar una base nueva independiente. El script no ejecuta CREATE DATABASE ni USE. No usar las bases existentes de trabajo o pruebas para ensayar la instalación.
3. Ejecutar el SQL en esa base mediante SSMS o sqlcmd, con soporte de separadores GO y codificación UTF-8. Ejemplo con marcadores que deben sustituirse, sin credenciales incrustadas:

   ```text
   sqlcmd -S <INSTANCIA> -d <BASE_NUEVA> -E -b -f 65001 -i docs/despliegue/sql/CFA-migraciones-idempotente.sql
   ```

4. Configurar externamente `ConnectionStrings:DefaultConnection` con la base nueva y una identidad SQL autorizada. **El appsettings.json versionado apunta actualmente a ControlFinancieroDB: no iniciar la API con ese destino por defecto durante una instalación de revisión.** La aplicación no ejecuta Migrate ni EnsureCreated al arrancar; el esquema debe estar preparado previamente.
5. Proporcionar mediante secretos de desarrollo o el mecanismo de secretos del entorno: `Jwt:Key` (al menos 32 bytes UTF-8), `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpirationMinutes` positivo (duración acordada: 30 minutos), `AdminInicial:Username` y `AdminInicial:Password`. No incorporar los valores al repositorio. La contraseña debe cumplir la política actual: al menos 12 caracteres, mayúscula, minúscula, número y símbolo.
6. Iniciar la API. `Program.cs` llama a `IdentitySeeder.SeedRolesAsync` y `SeedAdminAsync`: se crean los roles faltantes Administrador, PersonalArea, JefeArea y Auditor, y el administrador inicial si no existe ese nombre de usuario. El administrador se crea activo, sin área y con cambio obligatorio de contraseña.
7. Ingresar, completar el cambio obligatorio y crear las áreas y cuentas necesarias mediante las funciones autorizadas de CFA. No hay áreas ni operaciones financieras precargadas.
8. Para el frontend, ejecutar `npm ci` y `npm run build` desde `frontend`. Publicar con una configuración de servidor que resuelva `/api` hacia el backend; el proxy y su excepción de certificado son exclusivamente de desarrollo local.

El inicializador exige que las dos opciones AdminInicial estén presentes en cada arranque, incluso si el usuario ya existe. Si existe, no restablece contraseña, estado ni asignación de rol. Es una característica del código actual que debe considerarse al preparar el entorno; no se alteró aquí.

## Datos iniciales incluidos mediante migraciones

| Regla | Configuración original |
| --- | --- |
| MODIFICACION_REITERADA | Activa; umbral 3, ventana de 30 minutos. |
| FUERA_DE_HORARIO | Activa; 08:00–18:00, días 1,2,3,4,5. |
| LOGIN_FALLIDO_REITERADO | Activa; umbral 5, ventana de 15 minutos. |

Los marcadores de última evaluación se inicializan en NULL. El proceso periódico de detección se registra al iniciar la API y evalúa cada minuto; no requiere usuarios ni operaciones QA. No se ejecutó durante esta preparación. Los roles y el administrador se crean mediante código, no mediante el SQL entregado.

## Regeneración sin ejecutar migraciones

Desde la raíz del repositorio, con SDK .NET 9 y acceso a las dependencias NuGet:

```text
dotnet restore docs/despliegue/herramientas/GenerarSqlCfa/GenerarSqlCfa.csproj
dotnet run --project docs/despliegue/herramientas/GenerarSqlCfa/GenerarSqlCfa.csproj --configuration Release --no-restore -- <RUTA_SQL_NUEVA>
```

En esta revisión se restauraron las dependencias desde la caché local, sin instalar herramientas globales. El generador usa IMigrator.GenerateScript con la opción Idempotent, nunca Migrate. Rechaza sobrescribir el SQL o su manifiesto: elegir una ruta de salida nueva. Los binarios y archivos obj de la herramienta ya están cubiertos por el .gitignore existente.
