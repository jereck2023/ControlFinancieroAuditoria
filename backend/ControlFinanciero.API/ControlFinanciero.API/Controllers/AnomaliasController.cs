using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/anomalias")]
    [Authorize(Roles = Roles.Auditor)]
    public class AnomaliasController : ControllerBase
    {
        private readonly DeteccionAnomaliasService _deteccionService;

        public AnomaliasController(
            DeteccionAnomaliasService deteccionService)
        {
            _deteccionService = deteccionService;
        }

        [HttpPost("detectar")]
        public async Task<IActionResult> Detectar(
            CancellationToken cancellationToken)
        {
            int cantidad = await _deteccionService.DetectarAsync(
                cancellationToken);

            return Ok(new
            {
                mensaje = "Evaluacion de anomalias completada.",
                nuevasAlertas = cantidad
            });
        }
    }
}
