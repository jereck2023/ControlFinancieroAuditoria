namespace ControlFinanciero.API.DTOs
{
    public class ActualizarUsuarioRequest
    {
        public string NombreUsuario { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public int? AreaId { get; set; }
    }
}