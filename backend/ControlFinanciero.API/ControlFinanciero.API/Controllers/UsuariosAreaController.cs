using System.Security.Claims;
using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/usuarios/mi-area")]
    [Authorize(Roles = Roles.JefeArea)]
    public class UsuariosAreaController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public UsuariosAreaController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<List<UsuarioAreaResponse>>> ListarUsuariosDeMiArea()
        {
            var idTexto = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(idTexto, out var id))
                return Unauthorized();

            var solicitante = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == id && u.Activo);

            if (solicitante == null)
                return Unauthorized();

            if (!solicitante.AreaId.HasValue ||
                !await _context.Areas.AsNoTracking().AnyAsync(a =>
                    a.AreaId == solicitante.AreaId.Value && a.Activo))
            {
                return StatusCode(403, new
                {
                    mensaje = "No tiene un área institucional activa asignada."
                });
            }

            // The scope comes exclusively from the authenticated user, never query parameters.
            var usuarios = await _context.Users.AsNoTracking()
                .Where(u => u.AreaId == solicitante.AreaId.Value)
                .OrderBy(u => u.NombreCompleto).ThenBy(u => u.Id)
                .Select(u => new UsuarioAreaResponse
                {
                    Id = u.Id,
                    UserName = u.UserName ?? string.Empty,
                    NombreCompleto = u.NombreCompleto,
                    Activo = u.Activo
                }).ToListAsync();

            var roles = await (
                from ur in _context.UserRoles.AsNoTracking()
                join r in _context.Roles.AsNoTracking() on ur.RoleId equals r.Id
                join u in _context.Users.AsNoTracking() on ur.UserId equals u.Id
                where u.AreaId == solicitante.AreaId.Value
                select new { ur.UserId, r.Name }
            ).ToListAsync();

            var rolesPorUsuario = roles.ToLookup(r => r.UserId);
            foreach (var usuario in usuarios)
                usuario.Roles = rolesPorUsuario[usuario.Id]
                    .Where(r => r.Name != null).Select(r => r.Name!)
                    .OrderBy(nombre => nombre).ToList();

            return Ok(usuarios);
        }
    }
}
