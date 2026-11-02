namespace ControlFinanciero.API.DTOs
{
    public class HistorialAuditoriaListadoResponse
    {
        public int HistorialAuditoriaId { get; set; }

        public int RegistroFinancieroId { get; set; }

        public int? DocumentoFinancieroId { get; set; }

        public string NombreDocumento { get; set; } = "Sin documento de origen";

        public int AreaId { get; set; }

        public string NombreArea { get; set; } = string.Empty;

        public int UsuarioId { get; set; }

        public string NombreUsuario { get; set; } = string.Empty;

        public DateTime FechaHora { get; set; }

        public string TipoAccion { get; set; } = string.Empty;
    }
}
