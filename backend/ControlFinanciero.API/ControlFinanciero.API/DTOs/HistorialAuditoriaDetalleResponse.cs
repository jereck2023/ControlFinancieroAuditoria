using System.Text.Json;

namespace ControlFinanciero.API.DTOs
{
    public class HistorialAuditoriaDetalleResponse
        : HistorialAuditoriaListadoResponse
    {
        public JsonElement ValoresModificados { get; set; }
    }
}
