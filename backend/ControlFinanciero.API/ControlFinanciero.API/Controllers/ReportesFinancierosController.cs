using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using ControlFinanciero.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/reportes-financieros")]
    [Authorize(Roles = Roles.JefeArea + "," + Roles.Auditor)]
    public class ReportesFinancierosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly BitacoraActividadService _bitacoraService;
        private readonly ExcelFinancieroService _excelService;

        public ReportesFinancierosController(
            ApplicationDbContext context,
            BitacoraActividadService bitacoraService,
            ExcelFinancieroService excelService)
        {
            _context = context;
            _bitacoraService = bitacoraService;
            _excelService = excelService;
        }

        [HttpGet("detalle")]
        public async Task<IActionResult> ObtenerDetalle(
            [FromQuery] FiltroReporteFinancieroRequest filtro)
        {
            var usuarioIdTexto =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(usuarioIdTexto, out int usuarioId))
                return Unauthorized();

            var usuario = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == usuarioId && u.Activo);

            if (usuario == null)
                return Unauthorized();

            if (filtro.FechaDesde == null || filtro.FechaHasta == null ||
                filtro.FechaDesde > filtro.FechaHasta)
                return BadRequest(new { mensaje = "El período indicado no es válido." });

            if (filtro.SoloSinDocumento && filtro.DocumentoFinancieroId.HasValue)
                return BadRequest(new { mensaje = "Los filtros de documento son incompatibles." });

            bool esAuditor = User.IsInRole(Roles.Auditor);

            if (!esAuditor)
            {
                bool areaActiva = usuario.AreaId.HasValue &&
                    await _context.Areas.AsNoTracking().AnyAsync(a =>
                        a.AreaId == usuario.AreaId.Value && a.Activo);

                if (!areaActiva)
                    return StatusCode(403, new { mensaje = "El usuario no tiene un área activa." });

                if (filtro.AreaId.HasValue && filtro.AreaId != usuario.AreaId)
                    return StatusCode(403, new { mensaje = "No tiene permiso para consultar esta área." });
            }

            if (filtro.DocumentoFinancieroId.HasValue)
            {
                var documento = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d =>
                        d.DocumentoFinancieroId == filtro.DocumentoFinancieroId);

                if (documento == null ||
                    (!esAuditor && documento.AreaId != usuario.AreaId))
                    return NotFound(new { mensaje = "Documento financiero no encontrado." });

                if (filtro.AreaId.HasValue && documento.AreaId != filtro.AreaId)
                    return BadRequest(new { mensaje = "El documento no corresponde al área seleccionada." });
            }

            var consulta = _context.RegistrosFinancieros
                .AsNoTracking()
                .AsQueryable();

            if (!esAuditor)
                consulta = consulta.Where(r => r.AreaId == usuario.AreaId);
            else if (filtro.AreaId.HasValue)
                consulta = consulta.Where(r => r.AreaId == filtro.AreaId.Value);

            consulta = consulta.Where(r =>
                r.FechaOperacion >= filtro.FechaDesde.Value &&
                r.FechaOperacion <= filtro.FechaHasta.Value);

            if (!string.IsNullOrWhiteSpace(filtro.TipoOperacion))
                consulta = consulta.Where(r => r.TipoOperacion == filtro.TipoOperacion);

            if (filtro.DocumentoFinancieroId.HasValue)
                consulta = consulta.Where(r =>
                    r.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value);
            else if (filtro.SoloSinDocumento)
                consulta = consulta.Where(r => r.DocumentoFinancieroId == null);

            int totalRegistros = await consulta.CountAsync();

            if ((long)(filtro.Pagina - 1) * filtro.TamanoPagina > int.MaxValue)
                return BadRequest(new { mensaje = "La página solicitada está fuera del rango permitido." });

            var registros = await consulta
                .OrderByDescending(r => r.FechaOperacion)
                .ThenByDescending(r => r.RegistroFinancieroId)
                .Skip((filtro.Pagina - 1) * filtro.TamanoPagina)
                .Take(filtro.TamanoPagina)
                .Select(r => new MovimientoDetalleFinancieroResponse
                {
                    RegistroFinancieroId = r.RegistroFinancieroId,
                    FechaOperacion = r.FechaOperacion,
                    TipoOperacion = r.TipoOperacion,
                    Descripcion = r.Descripcion,
                    Monto = r.Monto,
                    AreaId = r.AreaId,
                    NombreArea = r.Area.Nombre,
                    UsuarioId = r.UsuarioId,
                    NombreUsuario = r.Usuario.NombreCompleto,
                    DocumentoFinancieroId = r.DocumentoFinancieroId,
                    NombreDocumento = r.DocumentoFinanciero != null
                        ? r.DocumentoFinanciero.NombreArchivo
                        : "Sin documento de origen"
                })
                .ToListAsync();

            var respuesta = new DetalleFinancieroResponse
            {
                TotalRegistros = totalRegistros,
                Pagina = filtro.Pagina,
                TamanoPagina = filtro.TamanoPagina,
                TotalPaginas = (int)Math.Ceiling(
                    (double)totalRegistros / filtro.TamanoPagina),
                FiltrosAplicados = filtro,
                Registros = registros
            };

            int? areaBitacora = esAuditor
                ? filtro.AreaId
                : usuario.AreaId;

            if (esAuditor && !areaBitacora.HasValue &&
                filtro.DocumentoFinancieroId.HasValue)
            {
                areaBitacora = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .Where(d => d.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value)
                    .Select(d => (int?)d.AreaId)
                    .FirstOrDefaultAsync();
            }

            await _bitacoraService.RegistrarAsync(new BitacoraActividad
            {
                TipoActividad = "GeneracionReporteFinanciero",
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = areaBitacora,
                DocumentoFinancieroId = filtro.DocumentoFinancieroId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = $"Reporte: Detalle Financiero. Desde: {filtro.FechaDesde:yyyy-MM-dd}. Hasta: {filtro.FechaHasta:yyyy-MM-dd}. Tipo: {filtro.TipoOperacion ?? "Todos"}. Área: {areaBitacora?.ToString() ?? "Todas"}. Documento: {filtro.DocumentoFinancieroId?.ToString() ?? (filtro.SoloSinDocumento ? "Sin documento de origen" : "Todos")}. Página: {filtro.Pagina}. Tamaño: {filtro.TamanoPagina}. Total: {totalRegistros}."
            });

            return Ok(respuesta);
        }

        [HttpGet("resumen")]
        public async Task<IActionResult> ObtenerResumen(
            [FromQuery] FiltroReporteFinancieroRequest filtro)
        {
            var usuarioIdTexto =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(usuarioIdTexto, out int usuarioId))
                return Unauthorized();

            var usuario = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == usuarioId && u.Activo);

            if (usuario == null)
                return Unauthorized();

            if (filtro.FechaDesde == null || filtro.FechaHasta == null ||
                filtro.FechaDesde > filtro.FechaHasta)
                return BadRequest(new { mensaje = "El período indicado no es válido." });

            if (filtro.SoloSinDocumento && filtro.DocumentoFinancieroId.HasValue)
                return BadRequest(new { mensaje = "Los filtros de documento son incompatibles." });

            bool esAuditor = User.IsInRole(Roles.Auditor);

            if (!esAuditor)
            {
                bool areaActiva = usuario.AreaId.HasValue &&
                    await _context.Areas.AsNoTracking().AnyAsync(a =>
                        a.AreaId == usuario.AreaId.Value && a.Activo);

                if (!areaActiva)
                    return StatusCode(403, new { mensaje = "El usuario no tiene un área activa." });

                if (filtro.AreaId.HasValue && filtro.AreaId != usuario.AreaId)
                    return StatusCode(403, new { mensaje = "No tiene permiso para consultar esta área." });
            }

            if (filtro.DocumentoFinancieroId.HasValue)
            {
                var documento = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d =>
                        d.DocumentoFinancieroId == filtro.DocumentoFinancieroId);

                if (documento == null ||
                    (!esAuditor && documento.AreaId != usuario.AreaId))
                    return NotFound(new { mensaje = "Documento financiero no encontrado." });

                if (filtro.AreaId.HasValue && documento.AreaId != filtro.AreaId)
                    return BadRequest(new { mensaje = "El documento no corresponde al área seleccionada." });
            }

            var consulta = _context.RegistrosFinancieros.AsNoTracking()
                .AsQueryable();

            if (!esAuditor)
                consulta = consulta.Where(r => r.AreaId == usuario.AreaId);
            else if (filtro.AreaId.HasValue)
                consulta = consulta.Where(r => r.AreaId == filtro.AreaId.Value);

            consulta = consulta.Where(r =>
                r.FechaOperacion >= filtro.FechaDesde.Value &&
                r.FechaOperacion <= filtro.FechaHasta.Value);

            if (!string.IsNullOrWhiteSpace(filtro.TipoOperacion))
                consulta = consulta.Where(r => r.TipoOperacion == filtro.TipoOperacion);

            if (filtro.DocumentoFinancieroId.HasValue)
                consulta = consulta.Where(r =>
                    r.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value);
            else if (filtro.SoloSinDocumento)
                consulta = consulta.Where(r => r.DocumentoFinancieroId == null);

            var totales = await consulta
                .GroupBy(r => 1)
                .Select(g => new
                {
                    CantidadIngresos = g.Count(r => r.TipoOperacion == "Ingreso"),
                    TotalIngresos = g.Sum(r => r.TipoOperacion == "Ingreso"
                        ? r.Monto : 0m),
                    CantidadEgresos = g.Count(r => r.TipoOperacion == "Egreso"),
                    TotalEgresos = g.Sum(r => r.TipoOperacion == "Egreso"
                        ? r.Monto : 0m)
                })
                .FirstOrDefaultAsync();

            var respuesta = new ResumenFinancieroResponse
            {
                CantidadIngresos = totales?.CantidadIngresos ?? 0,
                TotalIngresos = totales?.TotalIngresos ?? 0m,
                CantidadEgresos = totales?.CantidadEgresos ?? 0,
                TotalEgresos = totales?.TotalEgresos ?? 0m,
                Agrupacion = filtro.Agrupacion,
                FiltrosAplicados = filtro,
                Pagina = filtro.Pagina,
                TamanoPagina = filtro.TamanoPagina
            };

            if (filtro.Agrupacion == "Area")
            {
                var grupos = consulta
                    .GroupBy(r => new { r.AreaId, r.Area.Nombre })
                    .Select(g => new GrupoResumenFinancieroResponse
                    {
                        GrupoId = g.Key.AreaId,
                        NombreGrupo = g.Key.Nombre,
                        CantidadIngresos = g.Count(r => r.TipoOperacion == "Ingreso"),
                        TotalIngresos = g.Sum(r => r.TipoOperacion == "Ingreso"
                            ? r.Monto : 0m),
                        CantidadEgresos = g.Count(r => r.TipoOperacion == "Egreso"),
                        TotalEgresos = g.Sum(r => r.TipoOperacion == "Egreso"
                            ? r.Monto : 0m)
                    });

                var gruposCompletos = await grupos
                    .OrderBy(g => g.NombreGrupo)
                    .ThenBy(g => g.GrupoId)
                    .ToListAsync();

                respuesta.CantidadIngresos = gruposCompletos.Sum(g => g.CantidadIngresos);
                respuesta.TotalIngresos = gruposCompletos.Sum(g => g.TotalIngresos);
                respuesta.CantidadEgresos = gruposCompletos.Sum(g => g.CantidadEgresos);
                respuesta.TotalEgresos = gruposCompletos.Sum(g => g.TotalEgresos);

                respuesta.TotalGrupos = gruposCompletos.Count;
                respuesta.TotalPaginas = (int)Math.Ceiling(
                    (double)respuesta.TotalGrupos / filtro.TamanoPagina);

                respuesta.Grupos = gruposCompletos
                    .Skip((filtro.Pagina - 1) * filtro.TamanoPagina)
                    .Take(filtro.TamanoPagina)
                    .ToList();
            }

            else if (filtro.Agrupacion == "Documento")
            {
                var grupos = consulta
                    .GroupBy(r => new
                    {
                        r.DocumentoFinancieroId,
                        Nombre = r.DocumentoFinanciero != null
                            ? r.DocumentoFinanciero.NombreArchivo
                            : "Sin documento de origen"
                    })
                    .Select(g => new GrupoResumenFinancieroResponse
                    {
                        GrupoId = g.Key.DocumentoFinancieroId,
                        NombreGrupo = g.Key.Nombre,
                        CantidadIngresos = g.Count(r => r.TipoOperacion == "Ingreso"),
                        TotalIngresos = g.Sum(r => r.TipoOperacion == "Ingreso"
                            ? r.Monto : 0m),
                        CantidadEgresos = g.Count(r => r.TipoOperacion == "Egreso"),
                        TotalEgresos = g.Sum(r => r.TipoOperacion == "Egreso"
                            ? r.Monto : 0m)
                    });

                var gruposCompletos = await grupos
                    .OrderBy(g => g.NombreGrupo)
                    .ThenBy(g => g.GrupoId)
                    .ToListAsync();

                respuesta.CantidadIngresos = gruposCompletos.Sum(g => g.CantidadIngresos);
                respuesta.TotalIngresos = gruposCompletos.Sum(g => g.TotalIngresos);
                respuesta.CantidadEgresos = gruposCompletos.Sum(g => g.CantidadEgresos);
                respuesta.TotalEgresos = gruposCompletos.Sum(g => g.TotalEgresos);

                respuesta.TotalGrupos = gruposCompletos.Count;
                respuesta.TotalPaginas = (int)Math.Ceiling(
                    (double)respuesta.TotalGrupos / filtro.TamanoPagina);

                respuesta.Grupos = gruposCompletos
                    .Skip((filtro.Pagina - 1) * filtro.TamanoPagina)
                    .Take(filtro.TamanoPagina)
                    .ToList();
            }

            int? areaBitacora = esAuditor
                ? filtro.AreaId
                : usuario.AreaId;

            if (esAuditor && !areaBitacora.HasValue &&
                filtro.DocumentoFinancieroId.HasValue)
            {
                areaBitacora = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .Where(d => d.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value)
                    .Select(d => (int?)d.AreaId)
                    .FirstOrDefaultAsync();
            }

            await _bitacoraService.RegistrarAsync(new BitacoraActividad
            {
                TipoActividad = "GeneracionReporteFinanciero",
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = areaBitacora,
                DocumentoFinancieroId = filtro.DocumentoFinancieroId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = $"Reporte: Resumen Financiero. Desde: {filtro.FechaDesde:yyyy-MM-dd}. Hasta: {filtro.FechaHasta:yyyy-MM-dd}. Tipo: {filtro.TipoOperacion ?? "Todos"}. Área: {areaBitacora?.ToString() ?? "Todas"}. Documento: {filtro.DocumentoFinancieroId?.ToString() ?? (filtro.SoloSinDocumento ? "Sin documento de origen" : "Todos")}. Agrupación: {filtro.Agrupacion}. Grupos: {respuesta.TotalGrupos}. Ingresos: {respuesta.CantidadIngresos}. Egresos: {respuesta.CantidadEgresos}."
            });

            return Ok(respuesta);
        }


        [HttpGet("resumen/exportar")]
        public async Task<IActionResult> ExportarResumen(
            [FromQuery] FiltroReporteFinancieroRequest filtro)
        {
            var usuarioIdTexto =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(usuarioIdTexto, out int usuarioId))
                return Unauthorized();

            var usuario = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == usuarioId && u.Activo);

            if (usuario == null)
                return Unauthorized();

            if (filtro.FechaDesde == null || filtro.FechaHasta == null ||
                filtro.FechaDesde > filtro.FechaHasta)
                return BadRequest(new { mensaje = "El período indicado no es válido." });

            if (filtro.SoloSinDocumento && filtro.DocumentoFinancieroId.HasValue)
                return BadRequest(new { mensaje = "Los filtros de documento son incompatibles." });

            bool esAuditor = User.IsInRole(Roles.Auditor);

            if (!esAuditor)
            {
                bool areaActiva = usuario.AreaId.HasValue &&
                    await _context.Areas.AsNoTracking().AnyAsync(a =>
                        a.AreaId == usuario.AreaId.Value && a.Activo);

                if (!areaActiva)
                    return StatusCode(403, new { mensaje = "El usuario no tiene un área activa." });

                if (filtro.AreaId.HasValue && filtro.AreaId != usuario.AreaId)
                    return StatusCode(403, new { mensaje = "No tiene permiso para consultar esta área." });
            }

            if (filtro.DocumentoFinancieroId.HasValue)
            {
                var documento = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d =>
                        d.DocumentoFinancieroId == filtro.DocumentoFinancieroId);

                if (documento == null ||
                    (!esAuditor && documento.AreaId != usuario.AreaId))
                    return NotFound(new { mensaje = "Documento financiero no encontrado." });

                if (filtro.AreaId.HasValue && documento.AreaId != filtro.AreaId)
                    return BadRequest(new { mensaje = "El documento no corresponde al área seleccionada." });
            }

            var consulta = _context.RegistrosFinancieros.AsNoTracking()
                .AsQueryable();

            if (!esAuditor)
                consulta = consulta.Where(r => r.AreaId == usuario.AreaId);
            else if (filtro.AreaId.HasValue)
                consulta = consulta.Where(r => r.AreaId == filtro.AreaId.Value);

            consulta = consulta.Where(r =>
                r.FechaOperacion >= filtro.FechaDesde.Value &&
                r.FechaOperacion <= filtro.FechaHasta.Value);

            if (!string.IsNullOrWhiteSpace(filtro.TipoOperacion))
                consulta = consulta.Where(r => r.TipoOperacion == filtro.TipoOperacion);

            if (filtro.DocumentoFinancieroId.HasValue)
                consulta = consulta.Where(r =>
                    r.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value);
            else if (filtro.SoloSinDocumento)
                consulta = consulta.Where(r => r.DocumentoFinancieroId == null);

            var totales = await consulta
                .GroupBy(r => 1)
                .Select(g => new
                {
                    CantidadIngresos = g.Count(r => r.TipoOperacion == "Ingreso"),
                    TotalIngresos = g.Sum(r => r.TipoOperacion == "Ingreso"
                        ? r.Monto : 0m),
                    CantidadEgresos = g.Count(r => r.TipoOperacion == "Egreso"),
                    TotalEgresos = g.Sum(r => r.TipoOperacion == "Egreso"
                        ? r.Monto : 0m)
                })
                .FirstOrDefaultAsync();

            var reporte = new ResumenFinancieroResponse
            {
                CantidadIngresos = totales?.CantidadIngresos ?? 0,
                TotalIngresos = totales?.TotalIngresos ?? 0m,
                CantidadEgresos = totales?.CantidadEgresos ?? 0,
                TotalEgresos = totales?.TotalEgresos ?? 0m,
                Agrupacion = filtro.Agrupacion,
                FiltrosAplicados = filtro
            };

            if (filtro.Agrupacion == "Area")
            {
                reporte.Grupos = await consulta
                    .GroupBy(r => new { r.AreaId, r.Area.Nombre })
                    .Select(g => new GrupoResumenFinancieroResponse
                    {
                        GrupoId = g.Key.AreaId,
                        NombreGrupo = g.Key.Nombre,
                        CantidadIngresos = g.Count(r => r.TipoOperacion == "Ingreso"),
                        TotalIngresos = g.Sum(r => r.TipoOperacion == "Ingreso"
                            ? r.Monto : 0m),
                        CantidadEgresos = g.Count(r => r.TipoOperacion == "Egreso"),
                        TotalEgresos = g.Sum(r => r.TipoOperacion == "Egreso"
                            ? r.Monto : 0m)
                    })
                    .OrderBy(g => g.NombreGrupo)
                    .ThenBy(g => g.GrupoId)
                    .ToListAsync();
            }
            else if (filtro.Agrupacion == "Documento")
            {
                reporte.Grupos = await consulta
                    .GroupBy(r => new
                    {
                        r.DocumentoFinancieroId,
                        Nombre = r.DocumentoFinanciero != null
                            ? r.DocumentoFinanciero.NombreArchivo
                            : "Sin documento de origen"
                    })
                    .Select(g => new GrupoResumenFinancieroResponse
                    {
                        GrupoId = g.Key.DocumentoFinancieroId,
                        NombreGrupo = g.Key.Nombre,
                        CantidadIngresos = g.Count(r => r.TipoOperacion == "Ingreso"),
                        TotalIngresos = g.Sum(r => r.TipoOperacion == "Ingreso"
                            ? r.Monto : 0m),
                        CantidadEgresos = g.Count(r => r.TipoOperacion == "Egreso"),
                        TotalEgresos = g.Sum(r => r.TipoOperacion == "Egreso"
                            ? r.Monto : 0m)
                    })
                    .OrderBy(g => g.NombreGrupo)
                    .ThenBy(g => g.GrupoId)
                    .ToListAsync();
            }

            reporte.TotalGrupos = reporte.Grupos.Count;
            reporte.TotalPaginas = reporte.TotalGrupos == 0 ? 0 : 1;

            if (filtro.Agrupacion == "Area" || filtro.Agrupacion == "Documento")
            {
                reporte.CantidadIngresos = reporte.Grupos.Sum(g => g.CantidadIngresos);
                reporte.TotalIngresos = reporte.Grupos.Sum(g => g.TotalIngresos);
                reporte.CantidadEgresos = reporte.Grupos.Sum(g => g.CantidadEgresos);
                reporte.TotalEgresos = reporte.Grupos.Sum(g => g.TotalEgresos);
            }

            byte[] archivo = _excelService.GenerarExcelResumen(reporte);

            int? areaBitacora = esAuditor
                ? filtro.AreaId
                : usuario.AreaId;

            if (esAuditor && !areaBitacora.HasValue &&
                filtro.DocumentoFinancieroId.HasValue)
            {
                areaBitacora = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .Where(d => d.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value)
                    .Select(d => (int?)d.AreaId)
                    .FirstOrDefaultAsync();
            }

            await _bitacoraService.RegistrarAsync(new BitacoraActividad
            {
                TipoActividad = "ExportacionReporteFinanciero",
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = areaBitacora,
                DocumentoFinancieroId = filtro.DocumentoFinancieroId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = $"Reporte: Resumen Financiero. Desde: {filtro.FechaDesde:yyyy-MM-dd}. Hasta: {filtro.FechaHasta:yyyy-MM-dd}. Tipo: {filtro.TipoOperacion ?? "Todos"}. Agrupación: {filtro.Agrupacion}. Grupos exportados: {reporte.TotalGrupos}."
            });

            return File(
                archivo,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"ResumenFinanciero_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx");
        }

        [HttpGet("detalle/exportar")]
        public async Task<IActionResult> ExportarDetalle(
            [FromQuery] FiltroReporteFinancieroRequest filtro)
        {
            var usuarioIdTexto =
                User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(usuarioIdTexto, out int usuarioId))
                return Unauthorized();

            var usuario = await _context.Users.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == usuarioId && u.Activo);

            if (usuario == null)
                return Unauthorized();

            if (filtro.FechaDesde == null || filtro.FechaHasta == null ||
                filtro.FechaDesde > filtro.FechaHasta)
                return BadRequest(new { mensaje = "El período indicado no es válido." });

            if (filtro.SoloSinDocumento && filtro.DocumentoFinancieroId.HasValue)
                return BadRequest(new { mensaje = "Los filtros de documento son incompatibles." });

            bool esAuditor = User.IsInRole(Roles.Auditor);

            if (!esAuditor)
            {
                bool areaActiva = usuario.AreaId.HasValue &&
                    await _context.Areas.AsNoTracking().AnyAsync(a =>
                        a.AreaId == usuario.AreaId.Value && a.Activo);

                if (!areaActiva)
                    return StatusCode(403, new { mensaje = "El usuario no tiene un área activa." });

                if (filtro.AreaId.HasValue && filtro.AreaId != usuario.AreaId)
                    return StatusCode(403, new { mensaje = "No tiene permiso para consultar esta área." });
            }

            int? areaDocumento = null;

            if (filtro.DocumentoFinancieroId.HasValue)
            {
                var documento = await _context.DocumentosFinancieros
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d =>
                        d.DocumentoFinancieroId == filtro.DocumentoFinancieroId);

                if (documento == null ||
                    (!esAuditor && documento.AreaId != usuario.AreaId))
                    return NotFound(new { mensaje = "Documento financiero no encontrado." });

                if (filtro.AreaId.HasValue && documento.AreaId != filtro.AreaId)
                    return BadRequest(new { mensaje = "El documento no corresponde al área seleccionada." });

                areaDocumento = documento.AreaId;
            }

            var consulta = _context.RegistrosFinancieros
                .AsNoTracking()
                .AsQueryable();

            if (!esAuditor)
                consulta = consulta.Where(r => r.AreaId == usuario.AreaId);
            else if (filtro.AreaId.HasValue)
                consulta = consulta.Where(r => r.AreaId == filtro.AreaId.Value);

            consulta = consulta.Where(r =>
                r.FechaOperacion >= filtro.FechaDesde.Value &&
                r.FechaOperacion <= filtro.FechaHasta.Value);

            if (!string.IsNullOrWhiteSpace(filtro.TipoOperacion))
                consulta = consulta.Where(r => r.TipoOperacion == filtro.TipoOperacion);

            if (filtro.DocumentoFinancieroId.HasValue)
                consulta = consulta.Where(r =>
                    r.DocumentoFinancieroId == filtro.DocumentoFinancieroId.Value);
            else if (filtro.SoloSinDocumento)
                consulta = consulta.Where(r => r.DocumentoFinancieroId == null);

            var registros = await consulta
                .OrderByDescending(r => r.FechaOperacion)
                .ThenByDescending(r => r.RegistroFinancieroId)
                .Select(r => new MovimientoDetalleFinancieroResponse
                {
                    RegistroFinancieroId = r.RegistroFinancieroId,
                    FechaOperacion = r.FechaOperacion,
                    TipoOperacion = r.TipoOperacion,
                    Descripcion = r.Descripcion,
                    Monto = r.Monto,
                    AreaId = r.AreaId,
                    NombreArea = r.Area.Nombre,
                    UsuarioId = r.UsuarioId,
                    NombreUsuario = r.Usuario.NombreCompleto,
                    DocumentoFinancieroId = r.DocumentoFinancieroId,
                    NombreDocumento = r.DocumentoFinanciero != null
                        ? r.DocumentoFinanciero.NombreArchivo
                        : "Sin documento de origen"
                })
                .Take(10001)
                .ToListAsync();

            if (registros.Count > 10000)
                return BadRequest(new
                {
                    mensaje = "La exportación supera el límite de 10000 operaciones. Reduzca el período o los filtros."
                });

            var reporte = new DetalleFinancieroResponse
            {
                TotalRegistros = registros.Count,
                FiltrosAplicados = filtro,
                Registros = registros
            };

            byte[] archivo = _excelService.GenerarExcelDetalle(reporte);

            int? areaBitacora = esAuditor
                ? filtro.AreaId ?? areaDocumento
                : usuario.AreaId;

            await _bitacoraService.RegistrarAsync(new BitacoraActividad
            {
                TipoActividad = "ExportacionReporteFinanciero",
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = areaBitacora,
                DocumentoFinancieroId = filtro.DocumentoFinancieroId,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = $"Reporte: Detalle Financiero. Desde: {filtro.FechaDesde:yyyy-MM-dd}. Hasta: {filtro.FechaHasta:yyyy-MM-dd}. Tipo: {filtro.TipoOperacion ?? "Todos"}. Área: {areaBitacora?.ToString() ?? "Todas"}. Documento: {filtro.DocumentoFinancieroId?.ToString() ?? (filtro.SoloSinDocumento ? "Sin documento de origen" : "Todos")}. Operaciones exportadas: {registros.Count}."
            });

            return File(
                archivo,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                $"DetalleFinanciero_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx");
        }
    }
}
