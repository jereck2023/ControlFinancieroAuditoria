using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/bitacora-actividades")]
    [Authorize(Roles = Roles.Auditor + "," + Roles.JefeArea)]
    public class BitacoraActividadesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public BitacoraActividadesController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerActividades(
            [FromQuery] int? usuarioId,
            [FromQuery] int? documentoFinancieroId,
            [FromQuery] string? tipoActividad,
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
                    mensaje = "La página debe ser mayor que cero y el tamaño debe estar entre 1 y 100."
                });

            if (usuarioId.HasValue && usuarioId.Value <= 0)
                return BadRequest(new
                {
                    mensaje = "El identificador del usuario no es válido."
                });

            if (documentoFinancieroId.HasValue &&
                documentoFinancieroId.Value <= 0)
                return BadRequest(new
                {
                    mensaje = "El identificador del documento no es válido."
                });

            if (fechaDesde.HasValue && fechaHasta.HasValue &&
                fechaDesde.Value > fechaHasta.Value)
                return BadRequest(new
                {
                    mensaje = "La fecha inicial no puede superar la fecha final."
                });

            var consulta = _context.BitacorasActividades
                .AsNoTracking()
                .AsQueryable();

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(b =>
                    b.AreaId == usuario.AreaId);
            }

            if (usuarioId.HasValue)
                consulta = consulta.Where(b =>
                    b.UsuarioId == usuarioId.Value);

            if (documentoFinancieroId.HasValue)
                consulta = consulta.Where(b =>
                    b.DocumentoFinancieroId == documentoFinancieroId.Value);

            if (!string.IsNullOrWhiteSpace(tipoActividad))
            {
                var tipo = tipoActividad.Trim();

                consulta = consulta.Where(b =>
                    b.TipoActividad == tipo);
            }

            if (fechaDesde.HasValue)
                consulta = consulta.Where(b =>
                    b.FechaHora >= fechaDesde.Value);

            if (fechaHasta.HasValue)
                consulta = consulta.Where(b =>
                    b.FechaHora <= fechaHasta.Value);

            var totalRegistros = await consulta.CountAsync();

            var actividades = await consulta
                .OrderByDescending(b => b.FechaHora)
                .ThenByDescending(b => b.BitacoraActividadId)
                .Skip((int)Math.Min(
                    (long)(pagina - 1) * tamanoPagina,
                    int.MaxValue))
                .Take(tamanoPagina)
                .Select(b => new BitacoraActividadListadoResponse
                {
                    BitacoraActividadId = b.BitacoraActividadId,
                    FechaHora = b.FechaHora,
                    TipoActividad = b.TipoActividad,
                    Resultado = b.Resultado,
                    UsuarioId = b.UsuarioId,
                    NombreUsuario = b.NombreUsuario,
                    AreaId = b.AreaId,
                    NombreArea = b.Area != null
                        ? b.Area.Nombre
                        : null,
                    DocumentoFinancieroId = b.DocumentoFinancieroId,
                    NombreDocumento = b.NombreDocumento,
                    RegistroFinancieroId = b.RegistroFinancieroId
                })
                .ToListAsync();

            return Ok(new
            {
                pagina,
                tamanoPagina,
                totalRegistros,
                totalPaginas = (int)Math.Ceiling(
                    (double)totalRegistros / tamanoPagina),
                registros = actividades
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

            var consulta = _context.BitacorasActividades
                .AsNoTracking()
                .Where(b => b.BitacoraActividadId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(b =>
                    b.AreaId == usuario.AreaId);
            }

            var actividad = await consulta
                .Select(b => new BitacoraActividadDetalleResponse
                {
                    BitacoraActividadId = b.BitacoraActividadId,
                    FechaHora = b.FechaHora,
                    TipoActividad = b.TipoActividad,
                    Resultado = b.Resultado,
                    UsuarioId = b.UsuarioId,
                    NombreUsuario = b.NombreUsuario,
                    AreaId = b.AreaId,
                    NombreArea = b.Area != null
                        ? b.Area.Nombre
                        : null,
                    DocumentoFinancieroId = b.DocumentoFinancieroId,
                    NombreDocumento = b.NombreDocumento,
                    RegistroFinancieroId = b.RegistroFinancieroId,
                    DireccionIp = b.DireccionIp,
                    Detalle = b.Detalle
                })
                .FirstOrDefaultAsync();

            if (actividad == null)
                return NotFound(new
                {
                    mensaje = "Actividad no encontrada."
                });

            return Ok(actividad);
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

            if (User.IsInRole(Roles.Administrador))
                return false;

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
