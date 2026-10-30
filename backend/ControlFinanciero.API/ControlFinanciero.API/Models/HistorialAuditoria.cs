namespace ControlFinanciero.API.Models
{
    public class HistorialAuditoria
    {
        public int HistorialAuditoriaId { get; set; }

        public DateTime FechaHora { get; set; }

        public string TipoAccion { get; set; } = string.Empty;

        public string ValoresModificados { get; set; } = string.Empty;

        public int UsuarioId { get; set; }

        public ApplicationUser Usuario { get; set; } = null!;

        public int RegistroFinancieroId { get; set; }

        public RegistroFinanciero RegistroFinanciero { get; set; } = null!;
    }
}
