using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class CerrarAlertaRequest
    {
        [Required]
        public string Estado { get; set; } = string.Empty;

        [Required]
        [StringLength(1000, MinimumLength = 10)]
        public string Justificacion { get; set; } = string.Empty;

        [Required]
        public string RowVersion { get; set; } = string.Empty;
    }
}
