namespace ControlFinanciero.API.DTOs
{
    public class RegistroFinancieroResponse
    {
        public int RegistroFinancieroId { get; set; }
        public string TipoOperacion { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public DateOnly FechaOperacion { get; set; }
        public decimal Monto { get; set; }
        public int AreaId { get; set; }
        public string NombreArea { get; set; } = string.Empty;
        public int UsuarioId { get; set; }
        public string NombreUsuario { get; set; } = string.Empty;
        public string RowVersion { get; set; } = string.Empty;
    }
}
