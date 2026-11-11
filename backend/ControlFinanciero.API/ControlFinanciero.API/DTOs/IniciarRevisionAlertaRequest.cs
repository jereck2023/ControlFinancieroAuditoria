using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class IniciarRevisionAlertaRequest
    {
        [Required]
        public string RowVersion { get; set; } = string.Empty;
    }
}
