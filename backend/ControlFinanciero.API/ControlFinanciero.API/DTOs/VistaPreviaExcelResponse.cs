namespace ControlFinanciero.API.DTOs
{
    public class VistaPreviaExcelResponse
    {
        public int TotalFilas { get; set; }

        public List<FilaExcelFinanciero> Registros { get; set; } = new();

        public List<ErrorExcelFinanciero> Errores { get; set; } = new();

        public bool EsValido => Errores.Count == 0 && Registros.Count > 0;
        public string HashArchivo { get; set; } = string.Empty;
    }

    public class FilaExcelFinanciero
    {
        public int NumeroFila { get; set; }
        public string TipoOperacion { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public DateOnly FechaOperacion { get; set; }
        public decimal Monto { get; set; }
    }

    public class ErrorExcelFinanciero
    {
        public int NumeroFila { get; set; }
        public string Mensaje { get; set; } = string.Empty;
    }
}
