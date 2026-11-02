using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/historial-auditoria")]
    [Authorize(Roles = Roles.Auditor + "," + Roles.JefeArea)]
    public class HistorialAuditoriaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public HistorialAuditoriaController(
            ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerHistorial(
            [FromQuery] int? registroFinancieroId,
            [FromQuery] int? documentoFinancieroId,
            [FromQuery] int? usuarioId,
            [FromQuery] string? tipoAccion,
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

            if (pagina < 1 || tamanoPagina < 1 ||
                tamanoPagina > 100)
            {
                return BadRequest(new
                {
                    mensaje = "La página debe ser mayor que cero y el tamaño debe estar entre 1 y 100."
                });
            }

            if (registroFinancieroId.HasValue &&
                registroFinancieroId.Value <= 0)
                return BadRequest(new
                {
                    mensaje = "El identificador del registro no es válido."
                });

            if (usuarioId.HasValue && usuarioId.Value <= 0)
                return BadRequest(new
                {
                    mensaje = "El identificador del usuario no es válido."
                });

            if (fechaDesde.HasValue && fechaHasta.HasValue &&
                fechaDesde.Value > fechaHasta.Value)
                return BadRequest(new
                {
                    mensaje = "La fecha inicial no puede superar la fecha final."
                });

            tipoAccion = tipoAccion?.Trim();

            if (!string.IsNullOrEmpty(tipoAccion) &&
                tipoAccion != "Creacion" &&
                tipoAccion != "Modificacion")
            {
                return BadRequest(new
                {
                    mensaje = "La acción debe ser Creacion o Modificacion."
                });
            }

            var consulta = _context.HistorialesAuditoria
                .AsNoTracking()
                .AsQueryable();

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(h =>
                    h.RegistroFinanciero.AreaId == usuario.AreaId);
            }

            if (registroFinancieroId.HasValue)
                consulta = consulta.Where(h =>
                    h.RegistroFinancieroId == registroFinancieroId.Value);

            if (documentoFinancieroId.HasValue)
                consulta = consulta.Where(h =>
                    h.RegistroFinanciero.DocumentoFinancieroId ==
                    documentoFinancieroId.Value);

            if (usuarioId.HasValue)
                consulta = consulta.Where(h =>
                    h.UsuarioId == usuarioId.Value);

            if (!string.IsNullOrEmpty(tipoAccion))
                consulta = consulta.Where(h =>
                    h.TipoAccion == tipoAccion);

            if (fechaDesde.HasValue)
                consulta = consulta.Where(h =>
                    h.FechaHora >= fechaDesde.Value);

            if (fechaHasta.HasValue)
                consulta = consulta.Where(h =>
                    h.FechaHora <= fechaHasta.Value);

            var totalRegistros = await consulta.CountAsync();

            var historiales = await consulta
                .OrderByDescending(h => h.FechaHora)
                .ThenByDescending(h => h.HistorialAuditoriaId)
                .Skip((int)Math.Min(
                    (long)(pagina - 1) * tamanoPagina,
                    int.MaxValue))
                .Take(tamanoPagina)
                .Select(h => new HistorialAuditoriaListadoResponse
                {
                    HistorialAuditoriaId = h.HistorialAuditoriaId,
                    RegistroFinancieroId = h.RegistroFinancieroId,
                    DocumentoFinancieroId = h.RegistroFinanciero.DocumentoFinancieroId,
                    NombreDocumento = h.RegistroFinanciero.DocumentoFinanciero != null ? h.RegistroFinanciero.DocumentoFinanciero.NombreArchivo : "Sin documento de origen",
                    AreaId = h.RegistroFinanciero.AreaId,
                    NombreArea = h.RegistroFinanciero.Area.Nombre,
                    UsuarioId = h.UsuarioId,
                    NombreUsuario = h.Usuario.NombreCompleto,
                    FechaHora = h.FechaHora,
                    TipoAccion = h.TipoAccion
                })
                .ToListAsync();

            return Ok(new
            {
                pagina,
                tamanoPagina,
                totalRegistros,
                totalPaginas = (int)Math.Ceiling(
                    (double)totalRegistros / tamanoPagina),
                registros = historiales
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

            var consulta = _context.HistorialesAuditoria
                .AsNoTracking()
                .Where(h => h.HistorialAuditoriaId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(h =>
                    h.RegistroFinanciero.AreaId == usuario.AreaId);
            }

            var historial = await consulta
                .Select(h => new
                {
                    h.HistorialAuditoriaId,
                    h.RegistroFinancieroId,
                    DocumentoFinancieroId = h.RegistroFinanciero.DocumentoFinancieroId,
                    NombreDocumento = h.RegistroFinanciero.DocumentoFinanciero != null ? h.RegistroFinanciero.DocumentoFinanciero.NombreArchivo : "Sin documento de origen",
                    AreaId = h.RegistroFinanciero.AreaId,
                    NombreArea = h.RegistroFinanciero.Area.Nombre,
                    h.UsuarioId,
                    NombreUsuario = h.Usuario.NombreCompleto,
                    h.FechaHora,
                    h.TipoAccion,
                    h.ValoresModificados
                })
                .FirstOrDefaultAsync();

            if (historial == null)
                return NotFound(new
                {
                    mensaje = "Historial de auditoría no encontrado."
                });

            using var documento = JsonDocument.Parse(
                historial.ValoresModificados);

            var respuesta = new HistorialAuditoriaDetalleResponse
            {
                HistorialAuditoriaId = historial.HistorialAuditoriaId,
                RegistroFinancieroId = historial.RegistroFinancieroId,
                DocumentoFinancieroId = historial.DocumentoFinancieroId,
                NombreDocumento = historial.NombreDocumento,
                AreaId = historial.AreaId,
                NombreArea = historial.NombreArea,
                UsuarioId = historial.UsuarioId,
                NombreUsuario = historial.NombreUsuario,
                FechaHora = historial.FechaHora,
                TipoAccion = historial.TipoAccion,
                ValoresModificados = documento.RootElement.Clone()
            };

            return Ok(respuesta);
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
