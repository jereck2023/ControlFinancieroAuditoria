namespace ControlFinanciero.API.DTOs
{
    public class DocumentoFinancieroListadoResponse
    {
        public int DocumentoFinancieroId { get; set; }
        public string NombreArchivo { get; set; } = string.Empty;
        public int AreaId { get; set; }
        public string NombreArea { get; set; } = string.Empty;
        public int UsuarioId { get; set; }
        public string NombreUsuario { get; set; } = string.Empty;
        public DateTime FechaImportacion { get; set; }
        public int TotalRegistros { get; set; }
    }
}
