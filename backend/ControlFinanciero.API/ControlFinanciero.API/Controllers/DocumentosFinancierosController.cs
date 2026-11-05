using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ControlFinanciero.API.Services;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/documentos-financieros")]
    [Authorize(Roles = Roles.PersonalArea + "," +
                       Roles.JefeArea + "," +
                       Roles.Auditor)]
    public class DocumentosFinancierosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ExcelFinancieroService _excelService;
        private readonly BitacoraActividadService _bitacoraService;

        public DocumentosFinancierosController(
            ApplicationDbContext context,
            ExcelFinancieroService excelService,
            BitacoraActividadService bitacoraService)
        {
            _context = context;
            _excelService = excelService;
            _bitacoraService = bitacoraService;
        }

        private async Task RegistrarActividadDocumentoAsync(
            ApplicationUser usuario,
            int documentoId,
            string nombreDocumento,
            int areaId,
            string tipoActividad)
        {
            var actividad = new BitacoraActividad
            {
                TipoActividad = tipoActividad,
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = areaId,
                DocumentoFinancieroId = documentoId,
                NombreDocumento = nombreDocumento,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = tipoActividad == "ConsultaDocumentoFinanciero"
                    ? $"Consulta del documento {nombreDocumento} (ID: {documentoId})."
                    : $"Exportación del documento {nombreDocumento} (ID: {documentoId})."
            };

            await _bitacoraService.RegistrarAsync(actividad);
        }

        [HttpGet]
        public async Task<IActionResult> ObtenerDocumentos()
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!User.IsInRole(Roles.Auditor) &&
                !await TieneAreaActiva(usuario))
            {
                return Forbid();
            }

            var consulta = _context.DocumentosFinancieros
                .AsNoTracking()
                .AsQueryable();

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(
                    d => d.AreaId == usuario.AreaId);
            }

            var documentos = await consulta
                .OrderByDescending(d => d.FechaImportacion)
                .ThenByDescending(d => d.DocumentoFinancieroId)
                .Select(d => new DocumentoFinancieroListadoResponse
                {
                    DocumentoFinancieroId = d.DocumentoFinancieroId,
                    NombreArchivo = d.NombreArchivo,
                    AreaId = d.AreaId,
                    NombreArea = d.Area.Nombre,
                    UsuarioId = d.UsuarioId,
                    NombreUsuario = d.Usuario.NombreCompleto,
                    FechaImportacion = d.FechaImportacion,
                    TotalRegistros = d.RegistrosFinancieros.Count
                })
                .ToListAsync();

            return Ok(documentos);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> ObtenerDocumento(int id)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!User.IsInRole(Roles.Auditor) &&
                !await TieneAreaActiva(usuario))
            {
                return Forbid();
            }

            var consulta = _context.DocumentosFinancieros
                .AsNoTracking()
                .Where(d => d.DocumentoFinancieroId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(
                    d => d.AreaId == usuario.AreaId);
            }

            var documento = await consulta
                .Select(d => new DocumentoFinancieroDetalleResponse
                {
                    DocumentoFinancieroId = d.DocumentoFinancieroId,
                    NombreArchivo = d.NombreArchivo,
                    AreaId = d.AreaId,
                    NombreArea = d.Area.Nombre,
                    UsuarioId = d.UsuarioId,
                    NombreUsuario = d.Usuario.NombreCompleto,
                    FechaImportacion = d.FechaImportacion,
                    TotalRegistros = d.RegistrosFinancieros.Count,
                    HashArchivo = d.HashArchivo
                })
                .FirstOrDefaultAsync();

            if (documento == null)
            {
                return NotFound(new
                {
                    mensaje = "Documento financiero no encontrado."
                });
            }

            await RegistrarActividadDocumentoAsync(
                usuario,
                documento.DocumentoFinancieroId,
                documento.NombreArchivo,
                documento.AreaId,
                "ConsultaDocumentoFinanciero");

            return Ok(documento);
        }

        [HttpGet("{id:int}/registros")]
        public async Task<IActionResult> ObtenerRegistrosDocumento(int id)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!User.IsInRole(Roles.Auditor) &&
                !await TieneAreaActiva(usuario))
            {
                return Forbid();
            }

            var consulta = _context.DocumentosFinancieros
                .AsNoTracking()
                .Where(d => d.DocumentoFinancieroId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(
                    d => d.AreaId == usuario.AreaId);
            }

            var documento = await consulta
                .Select(d => new
                {
                    d.DocumentoFinancieroId,
                    d.NombreArchivo,
                    d.AreaId
                })
                .FirstOrDefaultAsync();

            if (documento == null)
            {
                return NotFound(new
                {
                    mensaje = "Documento financiero no encontrado."
                });
            }

            var registros = await _context.RegistrosFinancieros
                .AsNoTracking()
                .Where(r => r.DocumentoFinancieroId == id)
                .OrderByDescending(r => r.FechaOperacion)
                .ThenByDescending(r => r.RegistroFinancieroId)
                .Select(r => new RegistroFinancieroResponse
                {
                    RegistroFinancieroId = r.RegistroFinancieroId,
                    TipoOperacion = r.TipoOperacion,
                    Descripcion = r.Descripcion,
                    FechaOperacion = r.FechaOperacion,
                    Monto = r.Monto,
                    AreaId = r.AreaId,
                    NombreArea = r.Area.Nombre,
                    UsuarioId = r.UsuarioId,
                    NombreUsuario = r.Usuario.NombreCompleto,
                    RowVersion = Convert.ToBase64String(r.RowVersion)
                })
                .ToListAsync();


            await RegistrarActividadDocumentoAsync(
                usuario,
                documento.DocumentoFinancieroId,
                documento.NombreArchivo,
                documento.AreaId,
                "ConsultaDocumentoFinanciero");

            return Ok(registros);
        }

        [HttpGet("{id:int}/exportar")]
        public async Task<IActionResult> ExportarDocumento(int id)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!User.IsInRole(Roles.Auditor) &&
                !await TieneAreaActiva(usuario))
            {
                return Forbid();
            }

            var consulta = _context.DocumentosFinancieros
                .AsNoTracking()
                .Where(d => d.DocumentoFinancieroId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(
                    d => d.AreaId == usuario.AreaId);
            }

            var documento = await consulta
                .Select(d => new
                {
                    d.DocumentoFinancieroId,
                    d.NombreArchivo, 
                    d.AreaId
                })
                .FirstOrDefaultAsync();

            if (documento == null)
            {
                return NotFound(new
                {
                    mensaje = "Documento financiero no encontrado."
                });
            }

            var registros = await _context.RegistrosFinancieros
                .AsNoTracking()
                .Where(r =>
                    r.DocumentoFinancieroId == documento.DocumentoFinancieroId)
                .OrderBy(r => r.FechaOperacion)
                .ThenBy(r => r.RegistroFinancieroId)
                .Select(r => new RegistroFinancieroResponse
                {
                    RegistroFinancieroId = r.RegistroFinancieroId,
                    TipoOperacion = r.TipoOperacion,
                    Descripcion = r.Descripcion,
                    FechaOperacion = r.FechaOperacion,
                    Monto = r.Monto,
                    AreaId = r.AreaId,
                    NombreArea = r.Area.Nombre,
                    UsuarioId = r.UsuarioId,
                    NombreUsuario = r.Usuario.NombreCompleto
                })
                .ToListAsync();

            byte[] contenido = _excelService.GenerarExcel(registros);

            string nombreArchivo =
                $"CFA_Documento_{documento.DocumentoFinancieroId}_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";

            await RegistrarActividadDocumentoAsync(
                usuario,
                documento.DocumentoFinancieroId,
                documento.NombreArchivo,
                documento.AreaId,
                "ExportacionExcel");

            return File(
                contenido,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                nombreArchivo);
        }

        private async Task<ApplicationUser?> ObtenerUsuarioActual()
        {
            var identificador = User.FindFirst(
                ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value;

            if (!int.TryParse(identificador, out int usuarioId))
                return null;

            return await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u =>
                    u.Id == usuarioId && u.Activo);
        }

        private async Task<bool> TieneAreaActiva(
            ApplicationUser usuario)
        {
            if (!usuario.AreaId.HasValue)
                return false;

            return await _context.Areas
                .AsNoTracking()
                .AnyAsync(a =>
                    a.AreaId == usuario.AreaId.Value &&
                    a.Activo);
        }
    }
}
