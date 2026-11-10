namespace ControlFinanciero.API.Models
{
    public class ReglaAnomalia
    {
        public int ReglaAnomaliaId { get; set; }

        public string Codigo { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;

        public bool Activa { get; set; } = true;
        public DateTime? FechaUltimaEvaluacionUtc { get; set; }

        public int? Umbral { get; set; }
        public int? VentanaMinutos { get; set; }
        public TimeOnly? HoraInicio { get; set; }
        public TimeOnly? HoraFin { get; set; }
        public string? DiasSemana { get; set; }

        public ICollection<Alerta> Alertas { get; set; } = new List<Alerta>();
    }
}
