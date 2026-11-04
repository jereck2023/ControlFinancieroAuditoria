using ControlFinanciero.API.Data;
using ControlFinanciero.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ControlFinanciero.API.Services
{
    public class BitacoraActividadService
    {
        private readonly ApplicationDbContext _context;

        public BitacoraActividadService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task RegistrarAsync(BitacoraActividad actividad)
        {
            PrepararRegistro(actividad);

            await _context.SaveChangesAsync();
        }

        public void PrepararRegistro(BitacoraActividad actividad)
        {
            actividad.FechaHora = DateTime.UtcNow;

            actividad.NombreUsuario =
                (actividad.NombreUsuario ?? string.Empty).Trim();

            if (actividad.NombreUsuario.Length > 256)
            {
                actividad.NombreUsuario =
                    actividad.NombreUsuario[..256];
            }

            _context.BitacorasActividades.Add(actividad);
        }

        public async Task<bool> RegistrarConsultaAsync(
            BitacoraActividad actividad)
        {
            if (!actividad.UsuarioId.HasValue)
            {
                throw new ArgumentException(
                    "La consulta debe tener un usuario identificado.");
            }

            var limite = DateTime.UtcNow.AddSeconds(-60);

            var existe = await _context.BitacorasActividades
                .AsNoTracking()
                .AnyAsync(b =>
                    b.UsuarioId == actividad.UsuarioId &&
                    b.AreaId == actividad.AreaId &&
                    b.TipoActividad == actividad.TipoActividad &&
                    b.DocumentoFinancieroId ==
                        actividad.DocumentoFinancieroId &&
                    b.RegistroFinancieroId ==
                        actividad.RegistroFinancieroId &&
                    b.Detalle == actividad.Detalle &&
                    b.FechaHora >= limite);

            if (existe)
                return false;

            await RegistrarAsync(actividad);

            return true;
        }
    }
}
