# O3 · Preparación detenida; casos todavía pendientes

Fecha: **12/11/2026, Perú**. Ejecución `20261113003000`. Preparación autorizada por el usuario; se respetó su condición de detenerse ante un fallo. **Ninguna prueba funcional O3 quedó aprobada.**

## Resultado real

- Se creó exclusivamente **CFA_QA_O3_20261113003000**, en `[servidor SQL local: nombre de equipo omitido]`, SQL Server 2022 `16.0.1000.6`. Destino inexistente verificado antes de CREATE DATABASE; registrado a las `00:31:39.985 UTC` del 13/11 (19:31 del 12/11 en Perú).
- La generación del esquema utilizó las migraciones existentes de una copia idéntica de 78 archivos, dentro de frontend/tmp. No se ejecutó el arranque de la API para generar SQL ni se instaló dotnet-ef global/local. El arnés usa IMigrator de las dependencias existentes del backend.
- La aplicación del script **idempotente** se detuvo con **SqlException 156**, a las `00:31:41.376 UTC`. No hubo reintento ni corrección de migraciones.
- Lectura posterior: solo existe `__EFMigrationsHistory`, **0 migraciones aplicadas**, **0 logins** con el nombre temporal previsto y **0 sesiones API temporales**. No se creó ningún usuario/área QA ni se inició API en 7293 o Angular en 4293. No se afirma rollback general por el error: este estado fue consultado efectivamente después.
- Los 78 archivos originales volvieron a verificarse por SHA256: **0 cambios**. No se enviaron escrituras a ControlFinancieroDB o ControlFinancieroDB_Pruebas. No hubo contraseñas/JWT en archivos ni argumentos; los secretos generados solo existieron en memoria del proceso ya terminado.

## Error identificado y propuesta para retomar

El SQL idempotente generado contiene `CREATE TRIGGER TR_BitacorasActividades_Proteger` dentro de un `IF NOT EXISTS ... BEGIN`. Ese CREATE TRIGGER necesita un lote independiente y no puede ejecutarse en esa envoltura. Proviene de la operación SQL existente de `20261103161427_AgregarBitacoraActividades`; el arnés eligió generar un script idempotente. No se acredita un defecto de la protección del último administrador ni de sus endpoints: todavía no se invocaron.

Siguiente ajuste propuesto, **no aplicado ni ejecutado**: cambiar exclusivamente el arnés frontend para aplicar las migraciones existentes con `IMigrator.MigrateAsync("20261111005207_AgregarGestionAlertas")`, manteniendo sus límites de comandos originales y todas las verificaciones de destino. No editar las migraciones ni reemplazar el trigger. La base temporal existente puede reutilizarse porque la consulta confirmó que no tiene migraciones aplicadas; verificar de nuevo ese estado antes de reanudar. No borrar/recrear la base automáticamente.

Después: provisionar el login restringido, comprobar denegación en ambas bases protegidas, verificar conexión efectiva del proceso API antes del seeding mediante el bloqueo de preparación descrito en la propuesta, crear los fixtures mínimos y ejecutar los cinco escenarios previstos. **La reanudación se deja pendiente de indicación del usuario tras explicar el fallo.**

## Pruebas y límites

| Comprobación | Estado |
| --- | --- |
| Compilación del arnés y copia QA del backend | Correcta, 0 errores; advertencia NU1900 de consulta de vulnerabilidades NuGet no disponible, también fuera del sandbox. No equivale a prueba API ni a compilación Angular nueva. |
| Creación y consulta de la base temporal | Realizadas; estado conservado arriba. |
| Rechazo al desactivar único administrador | No ejecutado. |
| Rechazo al retirar Administrador del último activo | No ejecutado. |
| Tres pares de solicitudes concurrentes controladas | No ejecutados. |
| Invariante de administradores activos y bitácora de esos casos | No ejecutados; todavía no hay cuentas. |
| Comprobación en Angular/navegador | No ejecutada. |

Una consulta de diagnóstico intentó leer AspNetUsers y recibió 208 porque la tabla no existe; se corrigió únicamente la consulta de lectura usando sys.tables. No se ejecutó ninguna escritura para diagnosticar.

Evidencias: [resultado sanitizado](evidencias-o3/20261113003000/resultado.json), [hashes originales y copia](evidencias-o3/20261113003000/source-hashes.json). Arnés: `frontend/scripts/o3/O3.csproj` y `Program.cs`. Script generado retenido en `frontend/tmp/o3/20261113003000/schema.sql`, sin credenciales.

**Base temporal retenida, no eliminada. Login no creado. API no iniciada. O3 y O6 siguen pendientes; no se repitieron pruebas aprobadas.**
