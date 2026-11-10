using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ControlFinanciero.API.Services
{
    public class DeteccionAnomaliasService
    {
        private readonly ApplicationDbContext _context;
        private static readonly string[] Campos = { "TipoOperacion", "Descripcion", "FechaOperacion", "Monto" };
        private static readonly TimeZoneInfo ZonaPeru = ObtenerZonaPeru();
        private static readonly SemaphoreSlim ExclusividadDeteccion = new(1, 1);

        public DeteccionAnomaliasService(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<int> DetectarAsync(CancellationToken cancellationToken = default)
        {
            await ExclusividadDeteccion.WaitAsync(cancellationToken);
            try
            {
                var ahora = DateTime.UtcNow;
                var reglas = await _context.ReglasAnomalia
                    .Where(x => x.Activa)
                    .ToDictionaryAsync(x => x.Codigo, cancellationToken);

                DateTime InicioEvaluacion(ReglaAnomalia regla) =>
                    regla.FechaUltimaEvaluacionUtc ?? ahora.AddHours(-24);

                var desde = reglas.Values.Select(regla =>
                    InicioEvaluacion(regla).AddMinutes(-Math.Max(0, regla.VentanaMinutos ?? 0)))
                    .DefaultIfEmpty(ahora)
                    .Min();

                var nuevas = new List<Alerta>();

                if (reglas.TryGetValue("MODIFICACION_REITERADA", out var reglaCambios) ||
                    reglas.ContainsKey("FUERA_DE_HORARIO"))
                {
                    var historial = await _context.HistorialesAuditoria.AsNoTracking()
                        .Where(x => x.FechaHora >= desde && x.FechaHora <= ahora && x.TipoAccion == "Modificacion")
                        .Select(x => new
                        {
                            x.HistorialAuditoriaId,
                            x.FechaHora,
                            x.UsuarioId,
                            x.RegistroFinancieroId,
                            x.ValoresModificados,
                            AreaId = x.RegistroFinanciero.AreaId
                        })
                        .OrderBy(x => x.FechaHora)
                        .ThenBy(x => x.HistorialAuditoriaId)
                        .ToListAsync(cancellationToken);

                    var cambios = new List<CambioCampo>();
                    foreach (var h in historial)
                    {
                        foreach (var campo in ObtenerCamposCambiados(h.ValoresModificados))
                        {
                            cambios.Add(new CambioCampo(h.HistorialAuditoriaId, h.FechaHora,
                                h.UsuarioId, h.AreaId, h.RegistroFinancieroId, campo));
                        }
                    }

                    if (reglaCambios != null && reglaCambios.Umbral > 0 && reglaCambios.VentanaMinutos > 0)
                    {
                        foreach (var grupo in cambios.GroupBy(x => new { x.UsuarioId, x.RegistroFinancieroId, x.Campo }))
                        {
                            var eventos = grupo.OrderBy(x => x.FechaHora).ThenBy(x => x.Id).ToList();
                            var siguienteSinEvaluar = 0;
                            for (var i = 0; i < eventos.Count; i++)
                            {
                                var inicioVentana = eventos[i].FechaHora.AddMinutes(-reglaCambios.VentanaMinutos.Value);
                                var coincidencias = eventos.Skip(siguienteSinEvaluar).Take(i - siguienteSinEvaluar + 1)
                                    .Where(x => x.FechaHora >= inicioVentana).ToList();
                                if (coincidencias.Count < reglaCambios.Umbral.Value) continue;

                                var disparador = eventos[i];
                                if (disparador.FechaHora <= InicioEvaluacion(reglaCambios))
                                {
                                    siguienteSinEvaluar = i + 1;
                                    continue;
                                }
                                nuevas.Add(Crear(reglaCambios, "MODIFICACION_REITERADA", disparador.Id,
                                    disparador.FechaHora, disparador.UsuarioId, disparador.AreaId,
                                    disparador.RegistroFinancieroId, disparador.Campo,
                                    "Modificaciones reiteradas de un dato financiero",
                                    $"El usuario modificó {coincidencias.Count} veces el campo {disparador.Campo} del registro {disparador.RegistroFinancieroId} en {reglaCambios.VentanaMinutos} minutos.",
                                    new { HistorialesAuditoriaId = coincidencias.Select(x => x.Id).ToArray() }));
                                siguienteSinEvaluar = i + 1;
                            }
                        }
                    }

                    if (reglas.TryGetValue("FUERA_DE_HORARIO", out var reglaHorario))
                    {
                        foreach (var h in historial.Where(x =>
                                     x.FechaHora > InicioEvaluacion(reglaHorario) &&
                                     FueraHorario(x.FechaHora, reglaHorario)))
                        {
                            nuevas.Add(Crear(reglaHorario, "HORARIO_MODIFICACION", h.HistorialAuditoriaId,
                                h.FechaHora, h.UsuarioId, h.AreaId, h.RegistroFinancieroId, null,
                                "Modificación financiera fuera de horario",
                                "Se modificó un registro financiero fuera del horario de referencia.",
                                new { h.HistorialAuditoriaId }));
                        }
                    }
                }

                if (reglas.ContainsKey("FUERA_DE_HORARIO") || reglas.ContainsKey("LOGIN_FALLIDO_REITERADO"))
                {
                    var accesos = await _context.BitacorasActividades.AsNoTracking()
                        .Where(x => x.FechaHora >= desde && x.FechaHora <= ahora &&
                            (x.TipoActividad == "LoginExitoso" || x.TipoActividad == "LoginFallido"))
                        .OrderBy(x => x.FechaHora).ThenBy(x => x.BitacoraActividadId)
                        .ToListAsync(cancellationToken);

                    if (reglas.TryGetValue("FUERA_DE_HORARIO", out var reglaHorario))
                    {
                        foreach (var acceso in accesos.Where(x => x.TipoActividad == "LoginExitoso" &&
                                     x.Resultado == "Exitoso" && x.UsuarioId.HasValue &&
                                     x.FechaHora > InicioEvaluacion(reglaHorario) &&
                                     FueraHorario(x.FechaHora, reglaHorario)))
                        {
                            nuevas.Add(Crear(reglaHorario, "HORARIO_LOGIN", acceso.BitacoraActividadId,
                                acceso.FechaHora, acceso.UsuarioId, null, null, null,
                                "Inicio de sesión fuera de horario",
                                "Se registró un inicio de sesión exitoso fuera del horario de referencia.",
                                new { acceso.BitacoraActividadId }));
                        }
                    }

                    if (reglas.TryGetValue("LOGIN_FALLIDO_REITERADO", out var reglaLogin) &&
                        reglaLogin.Umbral > 0 && reglaLogin.VentanaMinutos > 0)
                    {
                        var fallos = accesos.Where(x => x.TipoActividad == "LoginFallido" &&
                            x.Resultado == "Fallido" && x.UsuarioId.HasValue &&
                            x.Detalle == "Contraseña incorrecta.");

                        foreach (var grupo in fallos.GroupBy(x => x.UsuarioId!.Value))
                        {
                            var eventos = grupo.ToList();
                            var siguienteSinEvaluar = 0;
                            for (var i = 0; i < eventos.Count; i++)
                            {
                                var inicioVentana = eventos[i].FechaHora.AddMinutes(-reglaLogin.VentanaMinutos.Value);
                                var coincidencias = eventos.Skip(siguienteSinEvaluar).Take(i - siguienteSinEvaluar + 1)
                                    .Where(x => x.FechaHora >= inicioVentana).ToList();
                                if (coincidencias.Count < reglaLogin.Umbral.Value) continue;

                                var disparador = eventos[i];
                                if (disparador.FechaHora <= InicioEvaluacion(reglaLogin))
                                {
                                    siguienteSinEvaluar = i + 1;
                                    continue;
                                }
                                nuevas.Add(Crear(reglaLogin, "LOGIN_FALLIDO_REITERADO", disparador.BitacoraActividadId,
                                    disparador.FechaHora, grupo.Key, null, null, null,
                                    "Intentos fallidos de contraseña reiterados",
                                    $"Se detectaron {coincidencias.Count} contraseñas incorrectas en {reglaLogin.VentanaMinutos} minutos para la misma cuenta.",
                                    new { BitacorasActividadId = coincidencias.Select(x => x.BitacoraActividadId).ToArray() }));
                                siguienteSinEvaluar = i + 1;
                            }
                        }
                    }
                }

                var agregar = new List<Alerta>();
                if (nuevas.Count > 0)
                {
                    var claves = nuevas.Select(x => x.ClaveDeteccion).Distinct().ToList();
                    var existentes = await _context.Alertas.AsNoTracking()
                        .Where(x => claves.Contains(x.ClaveDeteccion))
                        .Select(x => x.ClaveDeteccion)
                        .ToListAsync(cancellationToken);
                    var conjunto = existentes.ToHashSet(StringComparer.Ordinal);
                    agregar = nuevas.Where(x => conjunto.Add(x.ClaveDeteccion)).ToList();
                    if (agregar.Count > 0)
                        await _context.Alertas.AddRangeAsync(agregar, cancellationToken);
                }

                foreach (var regla in reglas.Values)
                    regla.FechaUltimaEvaluacionUtc = ahora;

                if (reglas.Count > 0)
                    await _context.SaveChangesAsync(cancellationToken);

                return agregar.Count;
            }
            finally
            {
                ExclusividadDeteccion.Release();
            }
        }

        private static Alerta Crear(ReglaAnomalia regla, string tipo, int eventoId, DateTime fecha,
            int? usuario, int? area, int? registro, string? campo, string titulo, string descripcion, object evidencias)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes($"{regla.ReglaAnomaliaId}:{tipo}:{eventoId}"));
            return new Alerta
            {
                ReglaAnomaliaId = regla.ReglaAnomaliaId,
                ClaveDeteccion = Convert.ToHexString(bytes).ToLowerInvariant(),
                Estado = "Pendiente",
                FechaHoraEvento = fecha,
                FechaHoraDeteccion = DateTime.UtcNow,
                UsuarioId = usuario,
                AreaId = area,
                RegistroFinancieroId = registro,
                CampoModificado = campo,
                Titulo = titulo,
                Descripcion = descripcion,
                EvidenciasJson = JsonSerializer.Serialize(evidencias)
            };
        }

        private static IEnumerable<string> ObtenerCamposCambiados(string json)
        {
            try
            {
                using var documento = JsonDocument.Parse(json);
                if (!documento.RootElement.TryGetProperty("Anteriores", out var anteriores) ||
                    !documento.RootElement.TryGetProperty("Nuevos", out var nuevos) ||
                    anteriores.ValueKind != JsonValueKind.Object || nuevos.ValueKind != JsonValueKind.Object)
                    return Array.Empty<string>();

                return Campos.Where(campo => anteriores.TryGetProperty(campo, out var anterior) &&
                    nuevos.TryGetProperty(campo, out var nuevo) &&
                    !string.Equals(anterior.GetRawText(), nuevo.GetRawText(), StringComparison.Ordinal)).ToArray();
            }
            catch (JsonException)
            {
                return Array.Empty<string>();
            }
        }

        private static bool FueraHorario(DateTime utc, ReglaAnomalia regla)
        {
            if (!regla.HoraInicio.HasValue || !regla.HoraFin.HasValue) return false;
            var local = TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), ZonaPeru);
            var dia = (int)local.DayOfWeek;
            var dias = (regla.DiasSemana ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (!dias.Contains(dia.ToString())) return true;
            var hora = TimeOnly.FromDateTime(local);
            return hora < regla.HoraInicio.Value || hora >= regla.HoraFin.Value;
        }

        private static TimeZoneInfo ObtenerZonaPeru()
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById("SA Pacific Standard Time"); }
            catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("America/Lima"); }
        }

        private sealed record CambioCampo(int Id, DateTime FechaHora, int UsuarioId, int AreaId,
            int RegistroFinancieroId, string Campo);
    }
}