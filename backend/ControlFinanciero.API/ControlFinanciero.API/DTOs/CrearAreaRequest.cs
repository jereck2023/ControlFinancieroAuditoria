using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class CrearAreaRequest
    {
        [Required(ErrorMessage = "El nombre del área es obligatorio.")]
        [StringLength(100, ErrorMessage = "El nombre del área no puede superar los 100 caracteres.")]
        public string Nombre { get; set; } = string.Empty;
    }
}
