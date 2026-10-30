namespace ControlFinanciero.API.Models
{
    public class RegistroFinanciero
    {
        public int RegistroFinancieroId { get; set; }
        public string TipoOperacion { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public DateOnly FechaOperacion { get; set; }
        public decimal Monto { get; set; }
        public int AreaId { get; set; }
        public Area Area { get; set; } = null!;
        public int UsuarioId { get; set; }
        public ApplicationUser Usuario { get; set; } = null!;
        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}
