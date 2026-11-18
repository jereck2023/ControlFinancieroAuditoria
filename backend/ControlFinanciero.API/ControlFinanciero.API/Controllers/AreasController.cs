using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using ControlFinanciero.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using System.Security.Claims;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/areas")]
    [Authorize]
    public class AreasController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly BitacoraActividadService _bitacoraService;

        public AreasController(
            ApplicationDbContext context,
            BitacoraActividadService bitacoraService)
        {
            _context = context;
            _bitacoraService = bitacoraService;
        }

        private async Task PrepararActividadAreaAsync(
            string tipoActividad,
            Area area,
            string detalle)
        {
            var idTexto = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(idTexto, out var administradorId))
                throw new InvalidOperationException(
                    "No se pudo identificar al administrador.");

            var administrador = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == administradorId && u.Activo);

            if (administrador == null)
                throw new InvalidOperationException(
                    "No se pudo identificar al administrador activo.");

            _bitacoraService.PrepararRegistro(new BitacoraActividad
            {
                TipoActividad = tipoActividad,
                Resultado = "Exitoso",
                UsuarioId = administrador.Id,
                NombreUsuario = administrador.UserName ?? string.Empty,
                AreaId = area.AreaId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = detalle
            });
        }


        [HttpGet]
        [Authorize(Roles = "Administrador,Auditor")]
        public async Task<ActionResult<List<AreaResponse>>> ObtenerAreas()
        {
            var areas = await _context.Areas
                .AsNoTracking()
                .OrderBy(a => a.Nombre)
                .Select(a => new AreaResponse
                {
                    AreaId = a.AreaId,
                    Nombre = a.Nombre,
                    Activo = a.Activo
                })
                .ToListAsync();

            return Ok(areas);
        }


        [HttpPost]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<AreaResponse>> CrearArea(
            [FromBody] CrearAreaRequest request)
        {
            var nombre = request.Nombre?.Trim();

            if (string.IsNullOrWhiteSpace(nombre))
            {
                return BadRequest(new
                {
                    mensaje = "El nombre del área es obligatorio."
                });
            }

            var existe = await _context.Areas
                .AnyAsync(a => a.Nombre == nombre);

            if (existe)
            {
                return Conflict(new
                {
                    mensaje = "Ya existe un área con ese nombre."
                });
            }

            var area = new Area
            {
                Nombre = nombre,
                Activo = true
            };

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            _context.Areas.Add(area);
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (
                ex.InnerException is SqlException sqlEx &&
                (sqlEx.Number == 2601 || sqlEx.Number == 2627))
            {
                return Conflict(new
                {
                    mensaje = "Ya existe un área con ese nombre."
                });
            }

            await PrepararActividadAreaAsync(
                "CreacionArea",
                area,
                $"Creación del área {area.Nombre} (ID: {area.AreaId}).");

            await _context.SaveChangesAsync();
            await transaccion.CommitAsync();

            var respuesta = new AreaResponse
            {
                AreaId = area.AreaId,
                Nombre = area.Nombre,
                Activo = area.Activo
            };

            return StatusCode(201, respuesta);
        }


        [HttpPut("{id:int}")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<AreaResponse>> ActualizarArea(
            int id, [FromBody] ActualizarAreaRequest request)
        {
            var nombre = request.Nombre?.Trim();

            if (string.IsNullOrWhiteSpace(nombre))
            {
                return BadRequest(new
                {
                    mensaje = "El nombre del área es obligatorio."
                });
            }

            var area = await _context.Areas.FindAsync(id);

            if (area == null)
            {
                return NotFound(new
                {
                    mensaje = "El área no existe."
                });
            }

            var existe = await _context.Areas
                .AnyAsync(a => a.AreaId != id && a.Nombre == nombre);

            if (existe)
            {
                return Conflict(new
                {
                    mensaje = "Ya existe otra área con ese nombre."
                });
            }

            area.Nombre = nombre;

            await PrepararActividadAreaAsync(
                "ActualizacionArea",
                area,
                $"Actualización del área {area.Nombre} (ID: {area.AreaId}).");

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex) when (
                ex.InnerException is SqlException sqlEx &&
                (sqlEx.Number == 2601 || sqlEx.Number == 2627))
            {
                return Conflict(new
                {
                    mensaje = "Ya existe otra área con ese nombre."
                });
            }

            return Ok(new AreaResponse
            {
                AreaId = area.AreaId,
                Nombre = area.Nombre,
                Activo = area.Activo
            });
        }


        [HttpPatch("{id:int}/desactivar")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<AreaResponse>> DesactivarArea(int id)
        {
            var area = await _context.Areas.FindAsync(id);

            if (area == null)
            {
                return NotFound(new
                {
                    mensaje = "El área no existe."
                });
            }

            if (!area.Activo)
            {
                return Conflict(new
                {
                    mensaje = "El área ya se encuentra desactivada."
                });
            }

            area.Activo = false;

            await PrepararActividadAreaAsync(
                "ActualizacionArea",
                area,
                $"Desactivación del área {area.Nombre} (ID: {area.AreaId}).");

            await _context.SaveChangesAsync();

            return Ok(new AreaResponse
            {
                AreaId = area.AreaId,
                Nombre = area.Nombre,
                Activo = area.Activo
            });
        }


        [HttpPatch("{id:int}/activar")]
        [Authorize(Roles = "Administrador")]
        public async Task<ActionResult<AreaResponse>> ActivarArea(int id)
        {
            var area = await _context.Areas.FindAsync(id);

            if (area == null)
            {
                return NotFound(new
                {
                    mensaje = "El área no existe."
                });
            }

            if (area.Activo)
            {
                return Conflict(new
                {
                    mensaje = "El área ya se encuentra activa."
                });
            }

            area.Activo = true;

            await PrepararActividadAreaAsync(
                "ActualizacionArea",
                area,
                $"Activación del área {area.Nombre} (ID: {area.AreaId}).");

            await _context.SaveChangesAsync();

            return Ok(new AreaResponse
            {
                AreaId = area.AreaId,
                Nombre = area.Nombre,
                Activo = area.Activo
            });
        }

    }
}
