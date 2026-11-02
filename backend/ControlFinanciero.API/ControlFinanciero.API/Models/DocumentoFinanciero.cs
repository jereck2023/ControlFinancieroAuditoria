namespace ControlFinanciero.API.Models
{
    public class DocumentoFinanciero
    {
        public int DocumentoFinancieroId { get; set; }

        public string NombreArchivo { get; set; } = string.Empty;

        public int AreaId { get; set; }
        public Area Area { get; set; } = null!;

        public int UsuarioId { get; set; }
        public ApplicationUser Usuario { get; set; } = null!;

        public DateTime FechaImportacion { get; set; }

        public string HashArchivo { get; set; } = string.Empty;

        public ICollection<RegistroFinanciero> RegistrosFinancieros { get; set; }
            = new List<RegistroFinanciero>();
    }
}
