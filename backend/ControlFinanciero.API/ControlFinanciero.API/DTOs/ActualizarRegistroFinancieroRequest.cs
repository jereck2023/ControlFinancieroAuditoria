using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class ActualizarRegistroFinancieroRequest
    {
        [Required]
        [RegularExpression("^(Ingreso|Egreso)$",
            ErrorMessage = "El tipo de operación debe ser Ingreso o Egreso.")]
        public string TipoOperacion { get; set; } = string.Empty;

        [Required]
        [StringLength(250)]
        public string Descripcion { get; set; } = string.Empty;

        [Required]
        public DateOnly? FechaOperacion { get; set; }

        [Required]
        [Range(typeof(decimal), "0.01", "9999999999999999.99")]
        public decimal? Monto { get; set; }

        [Required]
        public string RowVersion { get; set; } = string.Empty;
    }
}
