namespace ControlFinanciero.API.DTOs
{
    public class AreaResponse
    {
        public int AreaId { get; set; }

        public string Nombre { get; set; } = string.Empty;

        public bool Activo { get; set; }
    }
}
