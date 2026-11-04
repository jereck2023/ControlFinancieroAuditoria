namespace ControlFinanciero.API.DTOs
{
    public class BitacoraActividadListadoResponse
    {
        public int BitacoraActividadId { get; set; }

        public DateTime FechaHora { get; set; }

        public string TipoActividad { get; set; } = string.Empty;

        public string Resultado { get; set; } = string.Empty;

        public int? UsuarioId { get; set; }

        public string NombreUsuario { get; set; } = string.Empty;

        public int? AreaId { get; set; }

        public string? NombreArea { get; set; }

        public int? DocumentoFinancieroId { get; set; }

        public string? NombreDocumento { get; set; }

        public int? RegistroFinancieroId { get; set; }
    }
}
