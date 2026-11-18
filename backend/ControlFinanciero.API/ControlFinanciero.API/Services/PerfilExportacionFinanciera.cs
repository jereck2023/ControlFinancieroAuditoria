using System.Security.Claims;
using ControlFinanciero.API.Constants;

namespace ControlFinanciero.API.Services
{
    public enum PerfilExportacionFinanciera { PersonalArea, JefeArea, Auditor }

    public static class PerfilesExportacionFinanciera
    {
        public static PerfilExportacionFinanciera Obtener(ClaimsPrincipal usuario)
        {
            if (usuario.IsInRole(Roles.Auditor)) return PerfilExportacionFinanciera.Auditor;
            if (usuario.IsInRole(Roles.JefeArea)) return PerfilExportacionFinanciera.JefeArea;
            if (usuario.IsInRole(Roles.PersonalArea)) return PerfilExportacionFinanciera.PersonalArea;
            throw new UnauthorizedAccessException("No tiene permiso para exportar registros financieros.");
        }
    }
}
