namespace ControlFinanciero.API.DTOs
{
    public class BitacoraActividadDetalleResponse
        : BitacoraActividadListadoResponse
    {
        public string? DireccionIp { get; set; }

        public string? Detalle { get; set; }
    }
}
