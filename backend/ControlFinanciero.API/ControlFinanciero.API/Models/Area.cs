namespace ControlFinanciero.API.Models
{
    public class Area
    {
        public int AreaId { get; set; }

        public string Nombre { get; set; } = string.Empty;

        public bool Activo { get; set; } = true;

        public ICollection<ApplicationUser> Usuarios { get; set; }
            = new List<ApplicationUser>();
    }
}
