namespace ControlFinanciero.API.DTOs
{
    public class CrearUsuarioRequest
    {
        public string NombreUsuario { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string PasswordInicial { get; set; } = string.Empty;
        public int? AreaId { get; set; }
        public List<string> Roles { get; set; } = new();
    }
}