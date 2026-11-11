namespace ControlFinanciero.API.Models
{
    public class Alerta
    {
        public int AlertaId { get; set; }

        public int ReglaAnomaliaId { get; set; }
        public ReglaAnomalia ReglaAnomalia { get; set; } = null!;

        public string ClaveDeteccion { get; set; } = string.Empty;
        public string Estado { get; set; } = "Pendiente";

        public DateTime FechaHoraEvento { get; set; }
        public DateTime FechaHoraDeteccion { get; set; }

        public int? UsuarioId { get; set; }
        public ApplicationUser? Usuario { get; set; }

        public int? AreaId { get; set; }
        public Area? Area { get; set; }

        public int? RegistroFinancieroId { get; set; }
        public RegistroFinanciero? RegistroFinanciero { get; set; }

        public string? CampoModificado { get; set; }
        public string Titulo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;

        public string EvidenciasJson { get; set; } = "{}";

        public int? UsuarioRevisionId { get; set; }
        public ApplicationUser? UsuarioRevision { get; set; }

        public DateTime? FechaInicioRevisionUtc { get; set; }

        public int? UsuarioCierreId { get; set; }
        public ApplicationUser? UsuarioCierre { get; set; }

        public DateTime? FechaCierreUtc { get; set; }

        public string? JustificacionCierre { get; set; }

        public byte[] RowVersion { get; set; } = Array.Empty<byte>();
    }
}
