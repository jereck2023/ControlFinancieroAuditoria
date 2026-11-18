using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class FiltroRegistrosFinancierosRequest
    {
        [Range(1, int.MaxValue, ErrorMessage = "El ID del registro debe ser un entero positivo válido.")]
        public int? RegistroFinancieroId { get; set; }
    }
}
