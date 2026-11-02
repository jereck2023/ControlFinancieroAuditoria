namespace ControlFinanciero.API.DTOs
{
    public class DocumentoFinancieroDetalleResponse
        : DocumentoFinancieroListadoResponse
    {
        public string HashArchivo { get; set; } = string.Empty;
    }
}
