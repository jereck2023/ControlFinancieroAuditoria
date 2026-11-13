# CFA · Propuesta del siguiente bloque: O3, O6 y suspensión

**O3 y O6: solo preparación documental; no ejecutadas.** Fecha: 12/11/2026 (Perú). O9 y O10 están acreditadas; no repetir sus recorridos. Esta propuesta requiere aprobar sus condiciones antes de preparar ambientes o cargar datos. La suspensión complementaria se completó después, según su actualización más abajo. No se modifican backend, migraciones ni base principal.

## O3 · Protección del último administrador

**Actualización de preparación (12/11/2026):** el usuario autorizó proponer una **base temporal independiente con nombre propio**. La [propuesta concreta de aislamiento O3](propuesta-o3-aislamiento.md) sustituye la exigencia de otra instancia/base con nombre fijo de los puntos históricos siguientes. Propone SQL Server 2022 existente, base y login exclusivos, API/Angular separados y recuperación sin tocar las bases compartidas. **Pendiente de aprobación; nada preparado ni ejecutado.**

**No ejecutar sobre la base compartida actual.** El backend cuenta administradores activos globalmente dentro de su base: crear usuarios QA adicionales allí no permite comprobar al último mientras existan otros. No desactivar ni retirar roles a las cuentas existentes para conseguir esa condición.

Preparación histórica, sustituida por la propuesta enlazada en cuanto a destino/instancia:

1. El responsable proporciona **otra instancia SQL Server 2022 aislada y desechable**, con una base llamada exactamente **ControlFinancieroDB_Pruebas**, esquema compatible y únicamente cuentas nuevas del ensayo. No restaurar ni vaciar la base compartida, ni copiar cuentas ajenas. Si no se dispone de aislamiento, O3 queda pendiente.
2. Una instancia separada de la API, con el mismo código y configuración de conexión externa al proceso, apunta exclusivamente a esa base. No editar archivos del backend ni ejecutar su configuración base por defecto. Inventariar también los administradores creados por el seeding; deben pertenecer al ambiente desechable y contarse antes del caso.
3. Antes de escribir, verificar **instancia/servidor + base + proceso API/puerto** y el inventario de cuentas. El verificador actual asume SQL `localhost`: habrá que adaptar únicamente el arnés de frontend para validar el destino aislado explícito; comprobar solo el nombre de base sería insuficiente.
4. Con **un administrador QA activo**, comprobar los dos rechazos reales: desactivarlo y retirarle Administrador, solicitando roles válidos como PersonalArea y un área QA activa. Esperado según el backend: **409**, mensaje específico y administrador conservado. No usar roles vacíos para aparentar esta protección.
5. Con **dos administradores QA nuevos del ensayo**, enviar dos solicitudes concurrentes dirigidas solo a esas cuentas. Preparar por separado la carrera de desactivación y la de retirada de Administrador; no reutilizar como precondición una cuenta que ya quedó invalidada. Verificar respuestas, estado/roles finales y **al menos un administrador activo**, contemplando invalidaciones de sesión. No convertir un 500 en aprobación ni afirmar una carrera interna forzada de EF/SQL por haber enviado solicitudes simultáneas.

Conservar evidencia sin credenciales y un administrador QA recuperable hasta que el responsable cierre el ambiente desechable. No intentar desactivar al último como limpieza ni utilizar SQL para saltarse la protección.

## O6 · Frontera 10000 / 10001 de exportación

Preferencia: reutilizar el conjunto existente en la **ControlFinancieroDB_Pruebas compartida**, sin tocar cuentas ajenas. Se confirmó por lectura que el documento **12** conserva **500 registros**. No volver a importarlos ni repetir O5.

- Antes de cargar: volver a contar por **área QA 24 + período 12/11/2026**, confirmar que el alcance queda aislado y calcular el faltante real. Los 500 del documento 12 no garantizan por sí solos que el área no tenga otros movimientos.
- Si el alcance tiene exactamente 500 y se aprueba la preparación: agregar **9500** filas QA identificables mediante **19 importaciones distintas de 500**, usando la API existente, más **1** movimiento QA manual para alcanzar 10001. No generar estos datos ahora, insertar por SQL ni modificar los límites.
- Usar operadores QA nuevos y mantener intactas las cuentas conservadas; si hace falta reactivar el **área QA 24**, hacerlo solo como parte de la preparación autorizada y devolverla al estado inactivo al terminar. Verificar destino efectivo antes de cada petición que pueda escribir.
- Aislar exportación con **área + fechas**, sin fijar documento 12: ese filtro solo incluiría sus 500 filas y no probaría el umbral acumulado entre documentos. Sin escrituras concurrentes en ese alcance durante el caso.
- A **10000**, exportación real HTTP 200 y conteo exacto en el archivo. A **10001**, rechazo real **HTTP 400** con el mensaje del servidor y tratamiento correcto en Angular. Reducir un filtro hasta un alcance permitido y comprobar recuperación. Sin pruebas de estrés ni matrices de roles.
- La API no proporciona eliminación de estos registros/documentos: **los 10001 permanecerán identificados para trazabilidad**. La limpieza desactiva cuentas QA nuevas y restaura el estado inicial del área; no promete borrar la carga. Este costo de datos debe aceptarse antes de ejecutarla.

## C-O1-SUSP · Suspensión real de Windows, complementaria

**Actualización posterior: aprobada realmente el 12/11/2026.** Véase [informe y evidencias de suspensión](validacion-suspension-windows.md). No volver a ejecutar esta preparación; el texto siguiente conserva el criterio original. Los únicos casos obligatorios pendientes del bloque son O3 y O6.

Coordinar una ventana manual con el usuario, cuenta QA dedicada y expiración real del JWT. No cambiar estado, contraseña, roles ni área durante la espera. Suspender **realmente Windows antes del exp** y reanudar después, sin cerrar Angular/API ni cambiar reloj o configuración. Al regresar, verificar solicitud de credenciales, F5 sin acceso restaurado y, cuando la API vuelva a estar disponible, rechazo del token vencido. No simular eventos de visibilidad ni llamar suspensión a una pestaña en segundo plano. Si Windows no suspende realmente, dejar ese subcaso pendiente.

## Orden y condición para continuar

Primero confirmar si existe el ambiente aislado para O3 y si se acepta el volumen persistente mínimo de O6. Cada caso debe tener destino autorizado, conteos iniciales y recuperación/limpieza prevista antes de ejecutar. **O3/O6 siguen sin ejecutar ni generar datos.** La suspensión complementaria se completó en una ejecución posterior independiente con fixture dedicado 2025/1023, ya desactivado; no debe prepararse de nuevo.
