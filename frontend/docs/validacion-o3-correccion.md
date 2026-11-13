# O3 · Corrección mínima verificada y cierre funcional

**Aprobada realmente: 12/11/2026, Perú, 20:02.** Ejecución UTC 13/11/2026 01:02:37–01:02:47. Destino exclusivo **CFA_QA_O3_20261113003000**, API aislada HTTPS 7293. [Evidencia API/SQL completa](../scripts/o3/evidencias/20261113003000/reanudacion-20261113010237.json).

## Cambio autorizado

En `UsuariosController.DesactivarUsuario(int id)` se movió la llamada existente a `RegistrarActividadAdministrativaAsync` después de la protección del último administrador y antes de `usuario.Activo = false`. Es el único método funcional modificado. Continúan la misma transacción Serializable, bloqueo exclusivo CFA_Administradores, revalidación del actor, recarga del destinatario, protección del último activo y cambio de SecurityStamp. El helper de bitácora no se modificó. No se cambiaron entidades, ApplicationDbContext, migraciones, esquema ni archivos de configuración.

Se adaptó `frontend/scripts/o3/Program.cs` para probar el resultado corregido y sus regresiones, fijar el hash autorizado del controlador y comprobar que los otros 77 archivos originales/copias siguen idénticos. Se compiló el arnés y la copia QA de la API; no se inició la configuración original ni se compiló sobre bin/obj del backend original. Compilación correcta; persiste la advertencia NU1900 de consulta NuGet no disponible, sin errores de compilación.

## Comprobaciones reales aprobadas

| Prueba | Resultado y evidencia |
| --- | --- |
| Autodesactivación con otro administrador activo | **200**; usuario **1** confirmado inactivo por SQL; SecurityStamp cambió (solo comparación en memoria); exactamente una actividad **49**, CambioEstadoUsuario/Exitoso, responsable **1**, destino **1**. |
| Token de la cuenta autodesactivada | **401** al consultar usuarios con el mismo token anterior. No se persistió el token. |
| Desactivar al último administrador activo | **409** con mensaje específico; SQL conserva estado/roles; no agrega actividad administrativa de éxito. |
| Retirar Administrador al último activo | **409**; SQL conserva estado/roles; no agrega actividad administrativa de éxito. |
| Desactivaciones simultáneas de A/B por A | **409/200**, una sola actividad **54**, un administrador activo al terminar. El caso que anteriormente devolvía 500 ya no lo hace. |
| Retirada simultánea de roles a A/B por A | **200/401**, una sola actividad **59**, un administrador activo. |
| Desactivación/retirada de rol cruzadas entre A/B | **200/401**, una sola actividad **64**, un administrador activo. |
| Desactivación mutua simultánea entre A/B | **200/401**, una sola actividad **69**, un administrador activo. |

Los pares concurrentes registran intervalos HTTP solapados, sin reenvíos automáticos ni bloqueos SQL artificiales durante las carreras. SQL comprobó el invariante antes, tras cada respuesta y al finalizar cada caso; no apareció cero. La bitácora se cotejó por conteos, IDs, tipo, resultado, actor y detalle. Los baselines se restauraron por API, con sus actividades separadas de las de cada prueba. El caso 409 no se confundió con una invalidación 401.

El registro previo de bitácora sigue dentro de la transacción y su confirmación única. Los rechazos del último administrador ocurren antes de escribirlo. No se indujeron fallos SQL de guardado después de registrar la actividad: ese escenario no se declara probado; la atomicidad ante esos fallos se sustenta en la transacción mantenida, no en una nueva prueba de fallo artificial.

## Aislamiento, datos y límites

- Conexión SQL efectiva del PID/API/login temporal verificada antes del seeding y de las escrituras. Sin conexiones de prueba ni escrituras a ControlFinancieroDB o ControlFinancieroDB_Pruebas. La metadata de permisos se consultó desde la temporal.
- **12 migraciones ya aplicadas y 0 pendientes**, esquema comprobado sin ejecutar migraciones. Runtime sin sysadmin/db_owner.
- Se creó un administrador QA de recuperación **4** mediante el seeder original para recuperar acceso después de descartar credenciales del proceso anterior. El acceso a **1** se restableció mediante API; no se insertaron/editaron hashes o roles por SQL. Se reutilizó el área **1**.
- Baseline de esta ejecución: usuarios **1 y 4** activos; otros QA temporales **2 y 3** inactivos. Se comprobó que todos pertenecían al prefijo de esta ejecución antes de modificar cuentas. Estado final restaurado: **1 y 4 activos/Administrador**, **2 y 3 inactivos**, área **1** activa.
- API temporal PID **15244** detenida al finalizar; base/login conservados, no eliminados ni reconstruidos. Secretos y JWT solo en memoria del proceso, sin persistencia en evidencias.
- Regresión API/SQL real; no se atribuye a pruebas HTTP simuladas ni se declara nuevo recorrido de navegador. No se repitieron otros módulos, O6 o pruebas de carga. Las carreras internas de todas las topologías posibles siguen fuera de lo que puede probar esta ejecución finita.

**Resultado: defecto HTTP 500 corregido y O3 completamente aprobada dentro de su alcance acordado de API/SQL aislados. No quedan errores funcionales abiertos de O3.** Los resultados históricos con 500 se conservan como evidencia previa, no se borraron.
