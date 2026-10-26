using Microsoft.AspNetCore.Identity;

namespace ControlFinanciero.API.Models
{
    public class ApplicationUser : IdentityUser<int>
    {
        public string NombreCompleto { get; set; } = string.Empty;
        public bool Activo { get; set; } = true;
        public int? AreaId { get; set; }
        public Area? Area { get; set; } = null!;
        public bool DebeCambiarPassword { get; set; } = true;
    }
}
