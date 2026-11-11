using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using ControlFinanciero.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/alertas")]
    [Authorize(Roles = Roles.Auditor + "," + Roles.JefeArea)]
    public class GestionAlertasController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly BitacoraActividadService _bitacora;

        public GestionAlertasController(
            ApplicationDbContext context,
            BitacoraActividadService bitacora)
        {
            _context = context;
            _bitacora = bitacora;
        }

        [HttpPost("{id:int}/iniciar-revision")]
        public async Task<IActionResult> IniciarRevision(
            int id,
            [FromBody] IniciarRevisionAlertaRequest request)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (id <= 0)
                return BadRequest(new { mensaje = "Id de alerta invalido." });

            if (!TryLeerVersion(request.RowVersion, out var version))
                return BadRequest(new { mensaje = "RowVersion invalida." });

            var alerta = await ObtenerAlertaAutorizada(id, usuario);

            if (alerta == null)
                return NotFound(new { mensaje = "Alerta no encontrada." });

            if (alerta.Estado != "Pendiente")
                return Conflict(new
                {
                    mensaje = "Solo una alerta pendiente puede iniciar revision."
                });

            if (!alerta.RowVersion.SequenceEqual(version))
                return Conflict(new
                {
                    mensaje = "La alerta fue modificada. Consulte nuevamente."
                });

            _context.Entry(alerta)
                .Property(a => a.RowVersion)
                .OriginalValue = version;

            alerta.Estado = "En revision";
            alerta.UsuarioRevisionId = usuario.Id;
            alerta.FechaInicioRevisionUtc = DateTime.UtcNow;

            RegistrarActividad(
                usuario,
                alerta,
                "InicioRevisionAlerta",
                $"AlertaId={id}; EstadoAnterior=Pendiente; EstadoNuevo=En revision.");

            try
            {
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Revision iniciada correctamente.",
                    alertaId = alerta.AlertaId,
                    estado = alerta.Estado,
                    usuarioRevisionId = alerta.UsuarioRevisionId,
                    fechaInicioRevisionUtc = alerta.FechaInicioRevisionUtc,
                    rowVersion = Convert.ToBase64String(alerta.RowVersion)
                });
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new
                {
                    mensaje = "Otro usuario modifico la alerta. Consulte nuevamente."
                });
            }
        }

        [HttpPost("{id:int}/cerrar")]
        public async Task<IActionResult> CerrarAlerta(
            int id,
            [FromBody] CerrarAlertaRequest request)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (id <= 0)
                return BadRequest(new { mensaje = "Id de alerta invalido." });

            var estadoFinal = request.Estado?.Trim();
            var justificacion = request.Justificacion?.Trim();

            if (estadoFinal != "Resuelta" && estadoFinal != "Descartada")
                return BadRequest(new
                {
                    mensaje = "El estado debe ser Resuelta o Descartada."
                });

            if (string.IsNullOrWhiteSpace(justificacion) ||
                justificacion.Length < 10 ||
                justificacion.Length > 1000)
                return BadRequest(new
                {
                    mensaje = "La justificacion debe tener entre 10 y 1000 caracteres."
                });

            if (!TryLeerVersion(request.RowVersion, out var version))
                return BadRequest(new { mensaje = "RowVersion invalida." });

            var alerta = await ObtenerAlertaAutorizada(id, usuario);

            if (alerta == null)
                return NotFound(new { mensaje = "Alerta no encontrada." });

            if (alerta.Estado != "En revision")
                return Conflict(new
                {
                    mensaje = "Solo una alerta en revision puede cerrarse."
                });

            if (!alerta.RowVersion.SequenceEqual(version))
                return Conflict(new
                {
                    mensaje = "La alerta fue modificada. Consulte nuevamente."
                });

            _context.Entry(alerta)
                .Property(a => a.RowVersion)
                .OriginalValue = version;

            alerta.Estado = estadoFinal;
            alerta.UsuarioCierreId = usuario.Id;
            alerta.FechaCierreUtc = DateTime.UtcNow;
            alerta.JustificacionCierre = justificacion;

            RegistrarActividad(
                usuario,
                alerta,
                "CierreAlerta",
                $"AlertaId={id}; EstadoAnterior=En revision; " +
                $"EstadoNuevo={estadoFinal}; Justificacion={justificacion}");

            try
            {
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    mensaje = "Alerta cerrada correctamente.",
                    alertaId = alerta.AlertaId,
                    estado = alerta.Estado,
                    usuarioCierreId = alerta.UsuarioCierreId,
                    fechaCierreUtc = alerta.FechaCierreUtc,
                    justificacionCierre = alerta.JustificacionCierre,
                    rowVersion = Convert.ToBase64String(alerta.RowVersion)
                });
            }
            catch (DbUpdateConcurrencyException)
            {
                return Conflict(new
                {
                    mensaje = "Otro usuario modifico la alerta. Consulte nuevamente."
                });
            }
        }

        private async Task<ApplicationUser?> ObtenerUsuarioActual()
        {
            var idTexto = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(idTexto, out int usuarioId))
                return null;

            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == usuarioId && u.Activo);
        }

        private async Task<Alerta?> ObtenerAlertaAutorizada(
            int alertaId,
            ApplicationUser usuario)
        {
            var consulta = _context.Alertas
                .Where(a => a.AlertaId == alertaId);

            if (User.IsInRole(Roles.Auditor))
                return await consulta.FirstOrDefaultAsync();

            if (!User.IsInRole(Roles.JefeArea) ||
                !usuario.AreaId.HasValue)
                return null;

            var areaActiva = await _context.Areas
                .AsNoTracking()
                .AnyAsync(a =>
                    a.AreaId == usuario.AreaId.Value && a.Activo);

            if (!areaActiva)
                return null;

            return await consulta
                .Where(a =>
                    a.AreaId == usuario.AreaId.Value &&
                    a.RegistroFinancieroId != null &&
                    a.ReglaAnomalia.Codigo != "LOGIN_FALLIDO_REITERADO")
                .FirstOrDefaultAsync();
        }

        private void RegistrarActividad(
            ApplicationUser usuario,
            Alerta alerta,
            string tipoActividad,
            string detalle)
        {
            _bitacora.PrepararRegistro(new BitacoraActividad
            {
                TipoActividad = tipoActividad,
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = alerta.AreaId,
                RegistroFinancieroId = alerta.RegistroFinancieroId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = detalle
            });
        }

        private static bool TryLeerVersion(
            string? valor,
            out byte[] version)
        {
            version = Array.Empty<byte>();

            try
            {
                version = Convert.FromBase64String(valor ?? "");
                return version.Length == 8;
            }
            catch (FormatException)
            {
                return false;
            }
        }
    }
}
