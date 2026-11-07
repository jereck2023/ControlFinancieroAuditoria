namespace ControlFinanciero.API.DTOs
{
    public class DetalleFinancieroResponse
    {
        public int TotalRegistros { get; set; }
        public int Pagina { get; set; }
        public int TamanoPagina { get; set; }
        public int TotalPaginas { get; set; }

        public FiltroReporteFinancieroRequest FiltrosAplicados { get; set; } = new();

        public List<MovimientoDetalleFinancieroResponse> Registros { get; set; } = new();
    }

    public class MovimientoDetalleFinancieroResponse
    {
        public int RegistroFinancieroId { get; set; }
        public DateOnly FechaOperacion { get; set; }
        public string TipoOperacion { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public decimal Monto { get; set; }

        public int AreaId { get; set; }
        public string NombreArea { get; set; } = string.Empty;

        public int UsuarioId { get; set; }
        public string NombreUsuario { get; set; } = string.Empty;

        public int? DocumentoFinancieroId { get; set; }
        public string NombreDocumento { get; set; } = "Sin documento de origen";
    }
}
