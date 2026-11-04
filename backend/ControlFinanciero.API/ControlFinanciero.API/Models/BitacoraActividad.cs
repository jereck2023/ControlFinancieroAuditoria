namespace ControlFinanciero.API.Models
{
    public class BitacoraActividad
    {
        public int BitacoraActividadId { get; set; }

        public DateTime FechaHora { get; set; }

        public string TipoActividad { get; set; } = string.Empty;

        public string Resultado { get; set; } = string.Empty;

        public int? UsuarioId { get; set; }
        public ApplicationUser? Usuario { get; set; }

        public string NombreUsuario { get; set; } = string.Empty;

        public int? AreaId { get; set; }
        public Area? Area { get; set; }

        public int? DocumentoFinancieroId { get; set; }
        public DocumentoFinanciero? DocumentoFinanciero { get; set; }

        public string? NombreDocumento { get; set; }

        public int? RegistroFinancieroId { get; set; }
        public RegistroFinanciero? RegistroFinanciero { get; set; }

        public string? DireccionIp { get; set; }

        public string? Detalle { get; set; }
    }
}
