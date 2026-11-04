using ControlFinanciero.API.Data;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using ControlFinanciero.API.Constants;
using ControlFinanciero.API.DTOs;
using Microsoft.EntityFrameworkCore;
using System.Data;
using ControlFinanciero.API.Services;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/usuarios")]
    [Authorize(Roles = "Administrador")]
    public class UsuariosController : ControllerBase
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ApplicationDbContext _context;
        private readonly RoleManager<IdentityRole<int>> _roleManager;
        private readonly BitacoraActividadService _bitacoraService;

        public UsuariosController(
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole<int>> roleManager,
            ApplicationDbContext context,
            BitacoraActividadService bitacoraService)
        {
            _userManager = userManager;
            _roleManager = roleManager;
            _context = context;
            _bitacoraService = bitacoraService;
        }

        private async Task RegistrarActividadAdministrativaAsync(
            string tipoActividad,
            int? areaId,
            string detalle)
        {
            var administrador = await _userManager.GetUserAsync(User);

            if (administrador == null || !administrador.Activo)
            {
                throw new InvalidOperationException(
                    "No se pudo identificar al administrador responsable.");
            }

            _bitacoraService.PrepararRegistro(new BitacoraActividad
            {
                TipoActividad = tipoActividad,
                Resultado = "Exitoso",
                UsuarioId = administrador.Id,
                NombreUsuario = administrador.UserName ?? string.Empty,
                AreaId = areaId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = detalle
            });

            await _context.SaveChangesAsync();
        }

        [HttpPost]
        public async Task<IActionResult> CrearUsuario(
        [FromBody] CrearUsuarioRequest request)
        {
            var nombreUsuario = request.NombreUsuario?.Trim();
            var nombreCompleto = request.NombreCompleto?.Trim();

            if (string.IsNullOrWhiteSpace(nombreUsuario) ||
                string.IsNullOrWhiteSpace(nombreCompleto))
            {
                return BadRequest(new
                {
                    mensaje = "El nombre de usuario y el nombre completo son obligatorios."
                });
            }

            if (nombreCompleto.Length > 150)
            {
                return BadRequest(new
                {
                    mensaje = "El nombre completo no puede superar los 150 caracteres."
                });
            }

            if (string.IsNullOrWhiteSpace(request.PasswordInicial))
            {
                return BadRequest(new
                {
                    mensaje = "La contraseña inicial es obligatoria."
                });
            }

            if (request.Roles == null || request.Roles.Count == 0)
            {
                return BadRequest(new
                {
                    mensaje = "El usuario debe tener al menos un rol."
                });
            }

            var rolesDisponibles = new[]
            {
                Roles.Administrador,
                Roles.PersonalArea,
                Roles.JefeArea,
                Roles.Auditor
            };

            var rolesSolicitados = request.Roles
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Select(r => r.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (rolesSolicitados.Count == 0 ||
                rolesSolicitados.Any(r =>
                    !rolesDisponibles.Contains(
                        r, StringComparer.OrdinalIgnoreCase)))
            {
                return BadRequest(new
                {
                    mensaje = "Se ha especificado uno o más roles no válidos."
                });
            }

            // Utilizar los nombres oficiales de los roles
            rolesSolicitados = rolesSolicitados
                .Select(r => rolesDisponibles.First(
                    disponible => string.Equals(
                        disponible, r,
                        StringComparison.OrdinalIgnoreCase)))
                .ToList();

            foreach (var rol in rolesSolicitados)
            {
                if (!await _roleManager.RoleExistsAsync(rol))
                {
                    return BadRequest(new
                    {
                        mensaje = $"El rol {rol} no está disponible."
                    });
                }
            }

            bool soloAdministrador =
                rolesSolicitados.Count == 1 &&
                rolesSolicitados.Contains(Roles.Administrador);

            if (!soloAdministrador && request.AreaId == null)
            {
                return BadRequest(new
                {
                    mensaje = "Debe asignar un área institucional al usuario."
                });
            }

            if (request.AreaId.HasValue)
            {
                var area = await _context.Areas
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        a => a.AreaId == request.AreaId.Value);

                if (area == null)
                {
                    return BadRequest(new
                    {
                        mensaje = "El área institucional no existe."
                    });
                }

                if (!area.Activo)
                {
                    return BadRequest(new
                    {
                        mensaje = "No se pueden asignar usuarios a un área desactivada."
                    });
                }
            }

            var existente = await _userManager
                .FindByNameAsync(nombreUsuario!);

            if (existente != null)
            {
                return Conflict(new
                {
                    mensaje = "El nombre de usuario ya está registrado."
                });
            }

            var usuario = new ApplicationUser
            {
                UserName = nombreUsuario,
                NombreCompleto = nombreCompleto,
                AreaId = request.AreaId,
                Activo = true,
                DebeCambiarPassword = true
            };

            // Crear usuario y asignar roles como una sola operación.
            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            var resultado = await _userManager.CreateAsync(
                usuario, request.PasswordInicial);

            if (!resultado.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudo registrar el usuario.",
                    errores = resultado.Errors.Select(e => e.Description)
                });
            }

            var resultadoRoles = await _userManager
                .AddToRolesAsync(usuario, rolesSolicitados);

            if (!resultadoRoles.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudieron asignar los roles.",
                    errores = resultadoRoles.Errors.Select(e => e.Description)
                });
            }

            var administradorActual = await _userManager.GetUserAsync(User);

            if (administradorActual == null)
            {
                return Unauthorized(new
                {
                    mensaje = "No se pudo identificar al administrador."
                });
            }

            _bitacoraService.PrepararRegistro(new BitacoraActividad
            {
                TipoActividad = "CreacionUsuario",
                Resultado = "Exitoso",
                UsuarioId = administradorActual.Id,
                NombreUsuario = administradorActual.UserName ?? string.Empty,
                AreaId = usuario.AreaId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = $"Creación del usuario {usuario.UserName} (ID: {usuario.Id}). Roles asignados: {string.Join(", ", rolesSolicitados)}."
            });

            await _context.SaveChangesAsync();

            await transaccion.CommitAsync();

            return StatusCode(201, new
            {
                mensaje = "Usuario registrado correctamente.",
                usuario = new
                {
                    usuario.Id,
                    usuario.UserName,
                    usuario.NombreCompleto,
                    usuario.AreaId,
                    usuario.Activo,
                    usuario.DebeCambiarPassword,
                    Roles = rolesSolicitados
                }
            });
        }

        [HttpGet]
        public async Task<IActionResult> ListarUsuarios()
        {
            var usuarios = await _userManager.Users
                .AsNoTracking()
                .Include(u => u.Area)
                .OrderBy(u => u.Id)
                .ToListAsync();

            var resultado = new List<object>();

            foreach (var usuario in usuarios)
            {
                var roles = await _userManager.GetRolesAsync(usuario);

                resultado.Add(new
                {
                    usuario.Id,
                    usuario.UserName,
                    usuario.NombreCompleto,
                    usuario.AreaId,
                    NombreArea = usuario.Area?.Nombre,
                    usuario.Activo,
                    usuario.DebeCambiarPassword,
                    Roles = roles
                });
            }

            return Ok(resultado);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> ObtenerUsuario(int id)
        {
            var usuario = await _userManager.Users
                .AsNoTracking()
                .Include(u => u.Area)
                .FirstOrDefaultAsync(u => u.Id == id);

            if (usuario == null)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            var roles = await _userManager.GetRolesAsync(usuario);

            return Ok(new
            {
                usuario.Id,
                usuario.UserName,
                usuario.NombreCompleto,
                usuario.AreaId,
                NombreArea = usuario.Area?.Nombre,
                usuario.Activo,
                usuario.DebeCambiarPassword,
                Roles = roles
            });
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> ActualizarUsuario(
        int id,
        [FromBody] ActualizarUsuarioRequest request)
        {
            var usuario = await _userManager.FindByIdAsync(id.ToString());

            if (usuario == null)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            var nombreUsuario = request.NombreUsuario?.Trim();
            var nombreCompleto = request.NombreCompleto?.Trim();

            if (string.IsNullOrWhiteSpace(nombreUsuario) ||
                string.IsNullOrWhiteSpace(nombreCompleto))
            {
                return BadRequest(new
                {
                    mensaje = "El nombre de usuario y el nombre completo son obligatorios."
                });
            }

            if (nombreCompleto.Length > 150)
            {
                return BadRequest(new
                {
                    mensaje = "El nombre completo no puede superar los 150 caracteres."
                });
            }

            var usuarioExistente =
                await _userManager.FindByNameAsync(nombreUsuario);

            if (usuarioExistente != null && usuarioExistente.Id != id)
            {
                return Conflict(new
                {
                    mensaje = "El nombre de usuario ya está registrado."
                });
            }

            var roles = await _userManager.GetRolesAsync(usuario);

            bool soloAdministrador =
                roles.Count == 1 &&
                roles.Contains(Roles.Administrador);

            if (!soloAdministrador && request.AreaId == null)
            {
                return BadRequest(new
                {
                    mensaje = "Debe asignar un área institucional al usuario."
                });
            }

            if (request.AreaId.HasValue)
            {
                var area = await _context.Areas
                    .AsNoTracking()
                    .FirstOrDefaultAsync(
                        a => a.AreaId == request.AreaId.Value);

                if (area == null)
                {
                    return BadRequest(new
                    {
                        mensaje = "El área institucional no existe."
                    });
                }

                if (!area.Activo)
                {
                    return BadRequest(new
                    {
                        mensaje = "No se pueden asignar usuarios a un área desactivada."
                    });
                }
            }

            bool cambioDatosAcceso =
                usuario.UserName != nombreUsuario ||
                usuario.AreaId != request.AreaId;

            usuario.UserName = nombreUsuario;
            usuario.NombreCompleto = nombreCompleto;
            usuario.AreaId = request.AreaId;

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            var resultado = await _userManager.UpdateAsync(usuario);

            if (!resultado.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudo actualizar el usuario.",
                    errores = resultado.Errors.Select(e => e.Description)
                });
            }

            if (cambioDatosAcceso)
            {
                var resultadoStamp =
                    await _userManager.UpdateSecurityStampAsync(usuario);

                if (!resultadoStamp.Succeeded)
                {
                    return StatusCode(500, new
                    {
                        mensaje = "No se pudo actualizar la seguridad del usuario."
                    });
                }
            }

            await RegistrarActividadAdministrativaAsync(
                "ActualizacionUsuario",
                usuario.AreaId,
                $"Actualización del usuario {usuario.UserName} (ID: {usuario.Id}).");

            await transaccion.CommitAsync();

            return Ok(new
            {
                mensaje = "Usuario actualizado correctamente.",
                usuario = new
                {
                    usuario.Id,
                    usuario.UserName,
                    usuario.NombreCompleto,
                    usuario.AreaId,
                    usuario.Activo,
                    Roles = roles
                }
            });
        }

        [HttpPut("{id:int}/roles")]
        public async Task<IActionResult> ActualizarRoles(
        int id,
        [FromBody] ActualizarRolesRequest request)
        {
            await using var transaccion =
                await _context.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable);

            // Evitar cambios simultáneos que dejen al sistema sin administradores.
            var resultadoBloqueo = _context.Database
                .SqlQueryRaw<int>(
                """
                DECLARE @resultado INT;

                EXEC @resultado = sp_getapplock
                     @Resource = 'CFA_Administradores',
                     @LockMode = 'Exclusive',
                     @LockOwner = 'Transaction',
                     @LockTimeout = 10000;

                SELECT @resultado AS Value;
                """)
                .AsEnumerable()
                .Single();

            if (resultadoBloqueo < 0)
            {
                return StatusCode(503, new
                {
                    mensaje = "No se pudo obtener el bloqueo de seguridad. Intente nuevamente."
                });
            }

            // Volver a comprobar los permisos actuales tras obtener el bloqueo.
            var idAutenticado = User.FindFirst(
                System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            var stampToken = User.FindFirst("SecurityStamp")?.Value;

            if (!int.TryParse(idAutenticado, out var administradorId) ||
                string.IsNullOrWhiteSpace(stampToken))
            {
                return Unauthorized(new
                {
                    mensaje = "No se pudo verificar la autorización actual."
                });
            }

            var sigueAutorizado = await (
                from u in _context.Users.AsNoTracking()
                join ur in _context.UserRoles.AsNoTracking()
                    on u.Id equals ur.UserId
                join r in _context.Roles.AsNoTracking()
                    on ur.RoleId equals r.Id
                where u.Id == administradorId &&
                      u.Activo &&
                      u.SecurityStamp == stampToken &&
                      r.Name == Roles.Administrador
                select u.Id
            ).AnyAsync();

            if (!sigueAutorizado)
            {
                return Unauthorized(new
                {
                    mensaje = "La autorización cambió. Inicie sesión nuevamente."
                });
            }

            var usuario = await _userManager.FindByIdAsync(id.ToString());

            if (usuario == null)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            // FindByIdAsync puede reutilizar una entidad cargada antes del bloqueo.
            var entradaUsuario = _context.Entry(usuario);
            await entradaUsuario.ReloadAsync();

            if (entradaUsuario.State == EntityState.Detached)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            if (request.Roles == null || request.Roles.Count == 0)
            {
                return BadRequest(new
                {
                    mensaje = "El usuario debe tener al menos un rol."
                });
            }

            var rolesDisponibles = new[]
            {
                Roles.Administrador,
                Roles.PersonalArea,
                Roles.JefeArea,
                Roles.Auditor
    };

            var rolesNuevos = request.Roles
                .Where(r => !string.IsNullOrWhiteSpace(r))
                .Select(r => r.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (rolesNuevos.Count == 0 ||
                rolesNuevos.Any(r =>
                    !rolesDisponibles.Contains(
                        r, StringComparer.OrdinalIgnoreCase)))
            {
                return BadRequest(new
                {
                    mensaje = "Se ha especificado uno o más roles no válidos."
                });
            }

            rolesNuevos = rolesNuevos
                .Select(r => rolesDisponibles.First(
                    disponible => string.Equals(
                        disponible, r,
                        StringComparison.OrdinalIgnoreCase)))
                .ToList();

            var rolesActuales = await _userManager.GetRolesAsync(usuario);

            bool tieneRolAdministrador =
                rolesActuales.Contains(Roles.Administrador);

            bool conservaraRolAdministrador =
                rolesNuevos.Contains(Roles.Administrador);

            // Proteger al último administrador activo.
            if (usuario.Activo &&
                tieneRolAdministrador &&
                !conservaraRolAdministrador)
            {
                // Consultar directamente SQL Server, sin reutilizar entidades rastreadas.
                var hayOtroAdministradorActivo = await (
                    from u in _context.Users.AsNoTracking()
                    join ur in _context.UserRoles.AsNoTracking()
                        on u.Id equals ur.UserId
                    join r in _context.Roles.AsNoTracking()
                        on ur.RoleId equals r.Id
                    where u.Id != usuario.Id &&
                          u.Activo &&
                          r.Name == Roles.Administrador
                    select u.Id
                ).AnyAsync();

                if (!hayOtroAdministradorActivo)
                {
                    return Conflict(new
                    {
                        mensaje = "No se puede quitar el rol al último administrador activo."
                    });
                }
            }

            bool soloAdministrador =
                rolesNuevos.Count == 1 &&
                rolesNuevos.Contains(Roles.Administrador);

            if (!soloAdministrador && usuario.AreaId == null)
            {
                return BadRequest(new
                {
                    mensaje = "Debe asignar un área institucional antes de establecer estos roles."
                });
            }

            var rolesQuitar = rolesActuales
                .Except(rolesNuevos, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var rolesAgregar = rolesNuevos
                .Except(rolesActuales, StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (rolesQuitar.Count == 0 && rolesAgregar.Count == 0)
            {
                return Ok(new
                {
                    mensaje = "El usuario ya tiene los roles indicados.",
                    roles = rolesActuales
                });
            }

            if (rolesQuitar.Count > 0)
            {
                var resultadoQuitar = await _userManager
                    .RemoveFromRolesAsync(usuario, rolesQuitar);

                if (!resultadoQuitar.Succeeded)
                {
                    return BadRequest(new
                    {
                        mensaje = "No se pudieron retirar los roles.",
                        errores = resultadoQuitar.Errors.Select(e => e.Description)
                    });
                }
            }

            if (rolesAgregar.Count > 0)
            {
                var resultadoAgregar = await _userManager
                    .AddToRolesAsync(usuario, rolesAgregar);

                if (!resultadoAgregar.Succeeded)
                {
                    return BadRequest(new
                    {
                        mensaje = "No se pudieron asignar los nuevos roles.",
                        errores = resultadoAgregar.Errors.Select(e => e.Description)
                    });
                }
            }

            var resultadoStamp = await _userManager
                .UpdateSecurityStampAsync(usuario);

            if (!resultadoStamp.Succeeded)
            {
                return StatusCode(500, new
                {
                    mensaje = "No se pudo actualizar la seguridad del usuario."
                });
            }

            await RegistrarActividadAdministrativaAsync(
                "CambioRoles",
                usuario.AreaId,
                $"Cambio de roles del usuario {usuario.UserName} (ID: {usuario.Id}). " +
                $"Roles retirados: {(rolesQuitar.Count > 0 ? string.Join(", ", rolesQuitar) : "Ninguno")}. " +
                $"Roles agregados: {(rolesAgregar.Count > 0 ? string.Join(", ", rolesAgregar) : "Ninguno")}.");

            await transaccion.CommitAsync();

            return Ok(new
            {
                mensaje = "Roles actualizados correctamente.",
                usuarioId = usuario.Id,
                roles = rolesNuevos
            });
        }

        [HttpPut("{id:int}/desactivar")]
        public async Task<IActionResult> DesactivarUsuario(int id)
        {
            await using var transaccion =
                await _context.Database.BeginTransactionAsync(
                    IsolationLevel.Serializable);

            // Evitar modificaciones simultáneas de administradores.
            var resultadoBloqueo = _context.Database
                .SqlQueryRaw<int>(
                """
                DECLARE @resultado INT;

                EXEC @resultado = sp_getapplock
                     @Resource = 'CFA_Administradores',
                     @LockMode = 'Exclusive',
                     @LockOwner = 'Transaction',
                     @LockTimeout = 10000;

                SELECT @resultado AS Value;
                """)
                .AsEnumerable()
                .Single();

            if (resultadoBloqueo < 0)
            {
                return StatusCode(503, new
                {
                    mensaje = "No se pudo obtener el bloqueo de seguridad. Intente nuevamente."
                });
            }

            // Volver a comprobar los permisos actuales tras obtener el bloqueo.
            var idAutenticado = User.FindFirst(
                System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;
            var stampToken = User.FindFirst("SecurityStamp")?.Value;

            if (!int.TryParse(idAutenticado, out var administradorId) ||
                string.IsNullOrWhiteSpace(stampToken))
            {
                return Unauthorized(new
                {
                    mensaje = "No se pudo verificar la autorización actual."
                });
            }

            var sigueAutorizado = await (
                from u in _context.Users.AsNoTracking()
                join ur in _context.UserRoles.AsNoTracking()
                    on u.Id equals ur.UserId
                join r in _context.Roles.AsNoTracking()
                    on ur.RoleId equals r.Id
                where u.Id == administradorId &&
                      u.Activo &&
                      u.SecurityStamp == stampToken &&
                      r.Name == Roles.Administrador
                select u.Id
            ).AnyAsync();

            if (!sigueAutorizado)
            {
                return Unauthorized(new
                {
                    mensaje = "La autorización cambió. Inicie sesión nuevamente."
                });
            }

            var usuario = await _userManager.FindByIdAsync(id.ToString());

            if (usuario == null)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            // FindByIdAsync puede reutilizar una entidad cargada antes del bloqueo.
            var entradaUsuario = _context.Entry(usuario);
            await entradaUsuario.ReloadAsync();

            if (entradaUsuario.State == EntityState.Detached)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            if (!usuario.Activo)
            {
                return Conflict(new
                {
                    mensaje = "El usuario ya se encuentra desactivado."
                });
            }

            var roles = await _userManager.GetRolesAsync(usuario);

            if (roles.Contains(Roles.Administrador))
            {
                // Consultar directamente SQL Server, sin reutilizar entidades rastreadas.
                var hayOtroAdministradorActivo = await (
                    from u in _context.Users.AsNoTracking()
                    join ur in _context.UserRoles.AsNoTracking()
                        on u.Id equals ur.UserId
                    join r in _context.Roles.AsNoTracking()
                        on ur.RoleId equals r.Id
                    where u.Id != usuario.Id &&
                          u.Activo &&
                          r.Name == Roles.Administrador
                    select u.Id
                ).AnyAsync();

                if (!hayOtroAdministradorActivo)
                {
                    return Conflict(new
                    {
                        mensaje = "No se puede desactivar al último administrador activo."
                    });
                }
            }

            usuario.Activo = false;

            var resultado = await _userManager.UpdateAsync(usuario);

            if (!resultado.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudo desactivar el usuario.",
                    errores = resultado.Errors.Select(e => e.Description)
                });
            }

            var resultadoStamp = await _userManager
                .UpdateSecurityStampAsync(usuario);

            if (!resultadoStamp.Succeeded)
            {
                return StatusCode(500, new
                {
                    mensaje = "El usuario fue desactivado, pero no se pudo actualizar su seguridad."
                });
            }

            await RegistrarActividadAdministrativaAsync(
                "CambioEstadoUsuario",
                usuario.AreaId,
                $"Desactivación del usuario {usuario.UserName} (ID: {usuario.Id}).");

            await transaccion.CommitAsync();

            return Ok(new
            {
                mensaje = "Usuario desactivado correctamente.",
                usuarioId = usuario.Id,
                activo = usuario.Activo
            });
        }

        [HttpPut("{id:int}/activar")]
        public async Task<IActionResult> ActivarUsuario(int id)
        {
            var usuario = await _userManager.FindByIdAsync(id.ToString());

            if (usuario == null)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            if (usuario.Activo)
            {
                return Conflict(new
                {
                    mensaje = "El usuario ya se encuentra activo."
                });
            }

            var roles = await _userManager.GetRolesAsync(usuario);

            bool soloAdministrador =
                roles.Count == 1 &&
                roles.Contains(Roles.Administrador);

            if (!soloAdministrador && usuario.AreaId == null)
            {
                return Conflict(new
                {
                    mensaje = "No se puede activar al usuario porque no tiene un área institucional asignada."
                });
            }

            if (usuario.AreaId.HasValue)
            {
                var area = await _context.Areas
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a => a.AreaId == usuario.AreaId.Value);

                if (area == null || !area.Activo)
                {
                    return Conflict(new
                    {
                        mensaje = "No se puede activar al usuario porque su área institucional no existe o está desactivada."
                    });
                }
            }

            usuario.Activo = true;

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            var resultado = await _userManager.UpdateAsync(usuario);

            if (!resultado.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudo activar el usuario.",
                    errores = resultado.Errors.Select(e => e.Description)
                });
            }

            var resultadoStamp =
                await _userManager.UpdateSecurityStampAsync(usuario);

            if (!resultadoStamp.Succeeded)
            {
                return StatusCode(500, new
                {
                    mensaje = "No se pudo actualizar la seguridad del usuario."
                });
            }

            await RegistrarActividadAdministrativaAsync(
                "CambioEstadoUsuario",
                usuario.AreaId,
                $"Activación del usuario {usuario.UserName} (ID: {usuario.Id}).");

            await transaccion.CommitAsync();

            return Ok(new
            {
                mensaje = "Usuario activado correctamente.",
                usuarioId = usuario.Id,
                activo = usuario.Activo
            });
        }

        [HttpPut("{id:int}/restablecer-password")]
        public async Task<IActionResult> RestablecerPassword(
        int id,
        [FromBody] RestablecerPasswordRequest request)
        {
            var usuario = await _userManager.FindByIdAsync(id.ToString());

            if (usuario == null)
            {
                return NotFound(new
                {
                    mensaje = "El usuario solicitado no existe."
                });
            }

            if (!usuario.Activo)
            {
                return Conflict(new
                {
                    mensaje = "No se puede restablecer la contraseña de un usuario desactivado."
                });
            }

            if (string.IsNullOrWhiteSpace(request.PasswordNueva))
            {
                return BadRequest(new
                {
                    mensaje = "La nueva contraseña es obligatoria."
                });
            }

            // Validar las reglas de contraseña antes de modificarla.
            foreach (var validador in _userManager.PasswordValidators)
            {
                var validacion = await validador.ValidateAsync(
                    _userManager, usuario, request.PasswordNueva);

                if (!validacion.Succeeded)
                {
                    return BadRequest(new
                    {
                        mensaje = "La nueva contraseña no cumple los requisitos de seguridad.",
                        errores = validacion.Errors.Select(e => e.Description)
                    });
                }
            }

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            var token = await _userManager.GeneratePasswordResetTokenAsync(usuario);

            var resultado = await _userManager.ResetPasswordAsync(
                usuario, token, request.PasswordNueva);

            if (!resultado.Succeeded)
            {
                return BadRequest(new
                {
                    mensaje = "No se pudo restablecer la contraseña.",
                    errores = resultado.Errors.Select(e => e.Description)
                });
            }

            usuario.DebeCambiarPassword = true;

            var actualizacion = await _userManager.UpdateAsync(usuario);

            if (!actualizacion.Succeeded)
            {
                return StatusCode(500, new
                {
                    mensaje = "No se pudo completar el restablecimiento de contraseña."
                });
            }

            await RegistrarActividadAdministrativaAsync(
                "RestablecimientoPassword",
                usuario.AreaId,
                $"Restablecimiento administrativo de contraseña del usuario {usuario.UserName} (ID: {usuario.Id}).");

            await transaccion.CommitAsync();

            return Ok(new
            {
                mensaje = "Contraseña restablecida correctamente. El usuario deberá cambiarla al iniciar sesión nuevamente.",
                usuarioId = usuario.Id,
                debeCambiarPassword = usuario.DebeCambiarPassword
            });
        }
    }
}