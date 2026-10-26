using System.ComponentModel.DataAnnotations;

namespace ControlFinanciero.API.DTOs
{
    public class CambiarPasswordRequest
    {
        [Required(ErrorMessage = "La contraseña actual es obligatoria.")]
        public string PasswordActual { get; set; } = string.Empty;

        [Required(ErrorMessage = "La nueva contraseña es obligatoria.")]
        public string PasswordNueva { get; set; } = string.Empty;
    }
}