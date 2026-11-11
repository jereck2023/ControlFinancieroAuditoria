using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/alertas")]
    [Authorize(Roles = Roles.Auditor + "," + Roles.JefeArea)]
    public class AlertasController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AlertasController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerAlertas(
            [FromQuery] string? estado,
            [FromQuery] int? reglaAnomaliaId,
            [FromQuery] int? areaId,
            [FromQuery] int? usuarioId,
            [FromQuery] DateTime? fechaDesde,
            [FromQuery] DateTime? fechaHasta,
            [FromQuery] int pagina = 1,
            [FromQuery] int tamanoPagina = 20)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!await TienePermisoDeConsulta(usuario))
                return Forbid();

            if (pagina < 1 || tamanoPagina < 1 || tamanoPagina > 100)
                return BadRequest(new
                {
                    mensaje = "La pagina debe ser mayor que cero y el tamano debe estar entre 1 y 100."
                });

            if (reglaAnomaliaId <= 0 || areaId <= 0 || usuarioId <= 0)
                return BadRequest(new
                {
                    mensaje = "Los identificadores deben ser mayores que cero."
                });

            if (fechaDesde.HasValue && fechaHasta.HasValue &&
                fechaDesde.Value > fechaHasta.Value)
                return BadRequest(new
                {
                    mensaje = "La fecha inicial no puede superar la fecha final."
                });

            estado = estado?.Trim();

            if (!string.IsNullOrEmpty(estado) &&
                estado != "Pendiente" &&
                estado != "En revision" &&
                estado != "Resuelta" &&
                estado != "Descartada")
                return BadRequest(new
                {
                    mensaje = "El estado indicado no es valido."
                });

            var consulta = _context.Alertas
                .AsNoTracking()
                .AsQueryable();

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(a =>
                    a.AreaId == usuario.AreaId &&
                    a.RegistroFinancieroId != null &&
                    a.ReglaAnomalia.Codigo != "LOGIN_FALLIDO_REITERADO");
            }

            if (!string.IsNullOrEmpty(estado))
                consulta = consulta.Where(a => a.Estado == estado);

            if (reglaAnomaliaId.HasValue)
                consulta = consulta.Where(a =>
                    a.ReglaAnomaliaId == reglaAnomaliaId.Value);

            if (areaId.HasValue)
                consulta = consulta.Where(a =>
                    a.AreaId == areaId.Value);

            if (usuarioId.HasValue)
                consulta = consulta.Where(a =>
                    a.UsuarioId == usuarioId.Value);

            if (fechaDesde.HasValue)
                consulta = consulta.Where(a =>
                    a.FechaHoraEvento >= fechaDesde.Value);

            if (fechaHasta.HasValue)
                consulta = consulta.Where(a =>
                    a.FechaHoraEvento <= fechaHasta.Value);

            var totalRegistros = await consulta.CountAsync();

            var alertas = await consulta
                .OrderByDescending(a => a.FechaHoraDeteccion)
                .ThenByDescending(a => a.AlertaId)
                .Skip((int)Math.Min(
                    (long)(pagina - 1) * tamanoPagina,
                    int.MaxValue))
                .Take(tamanoPagina)
                .Select(a => new
                {
                    a.AlertaId,
                    a.Estado,
                    a.Titulo,
                    a.Descripcion,
                    a.FechaHoraEvento,
                    a.FechaHoraDeteccion,
                    a.ReglaAnomaliaId,
                    CodigoRegla = a.ReglaAnomalia.Codigo,
                    NombreRegla = a.ReglaAnomalia.Nombre,
                    a.UsuarioId,
                    NombreUsuario = a.Usuario != null
                        ? a.Usuario.NombreCompleto
                        : null,
                    a.AreaId,
                    NombreArea = a.Area != null
                        ? a.Area.Nombre
                        : null,
                    a.RegistroFinancieroId
                })
                .ToListAsync();

            return Ok(new
            {
                totalRegistros,
                pagina,
                tamanoPagina,
                totalPaginas = (int)Math.Ceiling(
                    (double)totalRegistros / tamanoPagina),
                alertas
            });
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> ObtenerDetalle(int id)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!await TienePermisoDeConsulta(usuario))
                return Forbid();

            if (id <= 0)
                return BadRequest(new
                {
                    mensaje = "El identificador de la alerta no es valido."
                });

            var consulta = _context.Alertas
                .AsNoTracking()
                .Where(a => a.AlertaId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(a =>
                    a.AreaId == usuario.AreaId &&
                    a.RegistroFinancieroId != null &&
                    a.ReglaAnomalia.Codigo != "LOGIN_FALLIDO_REITERADO");
            }

            var alerta = await consulta
                .Select(a => new
                {
                    a.AlertaId,
                    a.Estado,
                    a.Titulo,
                    a.Descripcion,
                    a.FechaHoraEvento,
                    a.FechaHoraDeteccion,
                    a.ReglaAnomaliaId,
                    CodigoRegla = a.ReglaAnomalia.Codigo,
                    NombreRegla = a.ReglaAnomalia.Nombre,
                    DescripcionRegla = a.ReglaAnomalia.Descripcion,
                    a.UsuarioId,
                    NombreUsuario = a.Usuario != null
                        ? a.Usuario.NombreCompleto
                        : null,
                    a.AreaId,
                    NombreArea = a.Area != null
                        ? a.Area.Nombre
                        : null,
                    a.RegistroFinancieroId,
                    a.CampoModificado,
                    a.EvidenciasJson,
                    a.UsuarioRevisionId,
                    a.FechaInicioRevisionUtc,
                    a.UsuarioCierreId,
                    a.FechaCierreUtc,
                    a.JustificacionCierre,
                    RowVersion = Convert.ToBase64String(a.RowVersion)
                })
                .FirstOrDefaultAsync();

            if (alerta == null)
                return NotFound(new
                {
                    mensaje = "Alerta no encontrada."
                });

            return Ok(alerta);
        }

        private async Task<ApplicationUser?> ObtenerUsuarioActual()
        {
            var identificador = User.FindFirst(
                ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(identificador, out int usuarioId))
                return null;

            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u =>
                    u.Id == usuarioId && u.Activo);
        }

        private async Task<bool> TienePermisoDeConsulta(
            ApplicationUser usuario)
        {
            if (User.IsInRole(Roles.Auditor))
                return true;

            if (!User.IsInRole(Roles.JefeArea))
                return false;

            if (!usuario.AreaId.HasValue)
                return false;

            return await _context.Areas
                .AsNoTracking()
                .AnyAsync(a =>
                    a.AreaId == usuario.AreaId.Value &&
                    a.Activo);
        }
    }
}
