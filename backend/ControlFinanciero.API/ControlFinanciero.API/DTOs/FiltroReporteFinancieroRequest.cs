using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class FiltroReporteFinancieroRequest
    {
        [Required]
        public DateOnly? FechaDesde { get; set; }

        [Required]
        public DateOnly? FechaHasta { get; set; }

        [RegularExpression("^(Ingreso|Egreso)$",
            ErrorMessage = "El tipo de operación debe ser Ingreso o Egreso.")]
        public string? TipoOperacion { get; set; }

        [Range(1, int.MaxValue)]
        public int? AreaId { get; set; }

        [Range(1, int.MaxValue)]
        public int? DocumentoFinancieroId { get; set; }

        public bool SoloSinDocumento { get; set; } = false;

        [RegularExpression("^(Ninguna|Area|Documento)$",
            ErrorMessage = "La agrupación debe ser Ninguna, Area o Documento.")]
        public string Agrupacion { get; set; } = "Ninguna";

        [Range(1, int.MaxValue)]
        public int Pagina { get; set; } = 1;

        [Range(1, 100)]
        public int TamanoPagina { get; set; } = 20;
    }
}
