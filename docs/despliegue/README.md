# Entrega e instalación nueva de CFA

Guía para preparar una instalación nueva del sistema de control financiero y auditoría CFA.

## Archivos de entrega

- `sql/ControlFinancieroDB.sql`: esquema desde cero hasta `20261111005207_AgregarGestionAlertas`, generado con EF Core SQL Server 9.0.20 a partir de las 12 migraciones originales.
- `herramientas/GenerarSqlCfa`: generador reproducible que compila las fuentes originales de esquema mediante enlaces; no inicia la API ni el inicializador de usuarios. Un interceptor bloquea cualquier apertura de conexión.

El SQL no es un respaldo de datos: contiene estructura, historial técnico de EF y configuración inicial de tres reglas. No contiene cuentas, contraseñas, tokens, áreas QA ni operaciones financieras. Las tablas de Identity conservan sus columnas necesarias, como PasswordHash y AspNetUserTokens, sin valores de credenciales.

## Alcance del script

Incluye 14 tablas de aplicación/Identity y la tabla técnica `__EFMigrationsHistory`, claves primarias y foráneas, índices, restricciones CHECK, columnas RowVersion, la intercalación Modern_Spanish_CI_AI y dos triggers de protección de trazabilidad. Las inserciones iniciales corresponden únicamente a reglas e historial EF.

SHA-256 del SQL: `EAEB9C540BF2B201145B1AF62828C7ADBE57AED745BEFC0D9E3F9AB83047A319`.

La operación SQL original que crea `TR_BitacorasActividades_Proteger` comienza con CREATE TRIGGER. Al quedar dentro del IF de un script idempotente, requiere su propio lote en SQL Server. El generador encapsula exactamente ese cuerpo en `EXEC(N'...')`, escapando las comillas, solo en el archivo de entrega. La migración original y el comportamiento del trigger no cambian. El trigger del historial ya usa SQL dinámico en su migración.

La idempotencia se basa en `__EFMigrationsHistory`: no repara un esquema arbitrario ni objetos eliminados manualmente. La ejecución inicial y su repetición deben comprobarse en una base nueva antes de utilizar el script en un entorno de destino; la generación y comprobación estática no sustituyen esa validación.

## Instalación nueva: pasos que deberá realizar el responsable

Ejecutar los siguientes pasos sobre una base nueva seleccionada expresamente para la instalación.

1. Disponer de SQL Server 2022 y .NET 9; para compilar, SDK .NET 9 y las herramientas Node indicadas por el frontend. Conservar el repositorio completo, los archivos de proyecto y `frontend/package-lock.json`.
2. Crear y seleccionar una base nueva independiente. El script no ejecuta CREATE DATABASE ni USE. No usar las bases existentes de trabajo o pruebas para ensayar la instalación.
3. Ejecutar el SQL en esa base mediante SSMS o sqlcmd, con soporte de separadores GO y codificación UTF-8. Ejemplo con marcadores que deben sustituirse, sin credenciales incrustadas:

   ```text
   sqlcmd -S <INSTANCIA> -d <BASE_NUEVA> -E -b -f 65001 -i docs/despliegue/sql/ControlFinancieroDB.sql
   ```

4. Configurar externamente `ConnectionStrings:DefaultConnection` con la base nueva y una identidad SQL autorizada. **El appsettings.json versionado apunta actualmente a ControlFinancieroDB: no iniciar la API con ese destino por defecto durante una instalación de revisión.** La aplicación no ejecuta Migrate ni EnsureCreated al arrancar; el esquema debe estar preparado previamente.
5. Proporcionar mediante secretos de desarrollo o el mecanismo de secretos del entorno: `Jwt:Key` (al menos 32 bytes UTF-8), `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpirationMinutes` positivo (duración acordada: 30 minutos), `AdminInicial:Username` y `AdminInicial:Password`. No incorporar los valores al repositorio. La contraseña debe cumplir la política actual: al menos 12 caracteres, mayúscula, minúscula, número y símbolo.
6. Iniciar la API. `Program.cs` llama a `IdentitySeeder.SeedRolesAsync` y `SeedAdminAsync`: se crean los roles faltantes Administrador, PersonalArea, JefeArea y Auditor, y el administrador inicial si no existe ese nombre de usuario. El administrador se crea activo, sin área y con cambio obligatorio de contraseña.
7. Ingresar, completar el cambio obligatorio y crear las áreas y cuentas necesarias mediante las funciones autorizadas de CFA. No hay áreas ni operaciones financieras precargadas.
8. Para el frontend, ejecutar `npm ci` y `npm run build` desde `frontend`. Publicar con una configuración de servidor que resuelva `/api` hacia el backend; el proxy y su excepción de certificado son exclusivamente de desarrollo local.

El inicializador exige que las dos opciones AdminInicial estén presentes en cada arranque, incluso si el usuario ya existe. Si existe, no restablece contraseña, estado ni asignación de rol.

## Datos iniciales incluidos mediante migraciones

| Regla | Configuración original |
| --- | --- |
| MODIFICACION_REITERADA | Activa; umbral 3, ventana de 30 minutos. |
| FUERA_DE_HORARIO | Activa; 08:00–18:00, días 1,2,3,4,5. |
| LOGIN_FALLIDO_REITERADO | Activa; umbral 5, ventana de 15 minutos. |

Los marcadores de última evaluación se inicializan en NULL. El proceso periódico de detección se registra al iniciar la API y evalúa cada minuto. Los roles y el administrador se crean mediante código, no mediante el SQL entregado.

## Regeneración sin ejecutar migraciones

Desde la raíz del repositorio, con SDK .NET 9 y acceso a las dependencias NuGet:

```text
dotnet restore docs/despliegue/herramientas/GenerarSqlCfa/GenerarSqlCfa.csproj
dotnet run --project docs/despliegue/herramientas/GenerarSqlCfa/GenerarSqlCfa.csproj --configuration Release --no-restore -- <RUTA_SQL_NUEVA>
```

El generador usa IMigrator.GenerateScript con la opción Idempotent, nunca Migrate. Indicar siempre una ruta de salida nueva: rechaza sobrescribir el SQL o su manifiesto de comprobación. Este último es un informe técnico local y no forma parte de la entrega académica. Los binarios y archivos obj de la herramienta están excluidos de Git.
