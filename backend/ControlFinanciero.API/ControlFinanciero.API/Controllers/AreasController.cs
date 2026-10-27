using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/areas")]
    [Authorize]
    public class AreasController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AreasController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
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
