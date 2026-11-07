namespace ControlFinanciero.API.DTOs
{
    public class ResumenFinancieroResponse
    {
        public int CantidadIngresos { get; set; }
        public decimal TotalIngresos { get; set; }

        public int CantidadEgresos { get; set; }
        public decimal TotalEgresos { get; set; }

        public decimal Diferencia => TotalIngresos - TotalEgresos;

        public string Agrupacion { get; set; } = "Ninguna";

        public FiltroReporteFinancieroRequest FiltrosAplicados { get; set; } = new();

        public int Pagina { get; set; } = 1;
        public int TamanoPagina { get; set; } = 20;
        public int TotalGrupos { get; set; }
        public int TotalPaginas { get; set; }

        public List<GrupoResumenFinancieroResponse> Grupos { get; set; } = new();
    }

    public class GrupoResumenFinancieroResponse
    {
        public int? GrupoId { get; set; }
        public string NombreGrupo { get; set; } = string.Empty;

        public int CantidadIngresos { get; set; }
        public decimal TotalIngresos { get; set; }

        public int CantidadEgresos { get; set; }
        public decimal TotalEgresos { get; set; }

        public decimal Diferencia => TotalIngresos - TotalEgresos;
    }
}
