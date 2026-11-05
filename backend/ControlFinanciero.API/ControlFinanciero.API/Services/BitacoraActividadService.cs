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

    }
}
