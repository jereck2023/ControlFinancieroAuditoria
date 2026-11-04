using ControlFinanciero.API.Constants;
using ControlFinanciero.API.Data;
using ControlFinanciero.API.DTOs;
using ControlFinanciero.API.Models;
using ControlFinanciero.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;
using System.Security.Cryptography;
using System.IO;

namespace ControlFinanciero.API.Controllers
{
    [ApiController]
    [Route("api/registros-financieros")]
    [Authorize]
    public class RegistrosFinancierosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ExcelFinancieroService _excelService;
        private readonly BitacoraActividadService _bitacoraService;

        public RegistrosFinancierosController(
            ApplicationDbContext context,
            ExcelFinancieroService excelService,
            BitacoraActividadService bitacoraService)
        {
            _context = context;
            _excelService = excelService;
            _bitacoraService = bitacoraService;
        }

        [HttpGet]
        [Authorize(Roles = Roles.PersonalArea + "," +
                           Roles.JefeArea + "," +
                           Roles.Auditor)]
        public async Task<IActionResult> ObtenerRegistros()
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            var consulta = _context.RegistrosFinancieros
                .AsNoTracking()
                .AsQueryable();

            if (!User.IsInRole(Roles.Auditor))
            {
                if (!await TieneAreaActiva(usuario))
                    return StatusCode(403, new
                    {
                        mensaje = "El usuario no tiene un área activa."
                    });

                consulta = consulta.Where(
                    r => r.AreaId == usuario.AreaId);
            }

            var registros = await consulta
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

            await _bitacoraService.RegistrarConsultaAsync(
                new BitacoraActividad
                {
                    TipoActividad = "ConsultaListadoFinanciero",
                    Resultado = "Exitoso",
                    UsuarioId = usuario.Id,
                    NombreUsuario = usuario.UserName ?? string.Empty,
                    AreaId = User.IsInRole(Roles.Auditor)
                        ? null
                        : usuario.AreaId,
                    DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    Detalle = "Consulta del listado general de registros financieros."
                });

            return Ok(registros);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = Roles.PersonalArea + "," +
                           Roles.JefeArea + "," +
                           Roles.Auditor)]
        public async Task<IActionResult> ObtenerRegistro(int id)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!User.IsInRole(Roles.Auditor) &&
                !await TieneAreaActiva(usuario))
            {
                return StatusCode(403, new
                {
                    mensaje = "El usuario no tiene un área activa."
                });
            }

            var consulta = _context.RegistrosFinancieros
                .AsNoTracking()
                .Where(r => r.RegistroFinancieroId == id);

            if (!User.IsInRole(Roles.Auditor))
            {
                consulta = consulta.Where(
                    r => r.AreaId == usuario.AreaId);
            }

            var registro = await consulta
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
                .FirstOrDefaultAsync();

            if (registro == null)
                return NotFound(new
                {
                    mensaje = "Registro financiero no encontrado."
                });

            await _bitacoraService.RegistrarConsultaAsync(
                new BitacoraActividad
                {
                    TipoActividad = "ConsultaDetalleFinanciero",
                    Resultado = "Exitoso",
                    UsuarioId = usuario.Id,
                    NombreUsuario = usuario.UserName ?? string.Empty,
                    AreaId = registro.AreaId,
                    RegistroFinancieroId = registro.RegistroFinancieroId,
                    DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    Detalle = $"Consulta del registro financiero ID: {registro.RegistroFinancieroId}."
                });

            return Ok(registro);
        }

        [HttpPost]
        [Authorize(Roles = Roles.PersonalArea)]
        public async Task<IActionResult> CrearRegistro(
            [FromBody] CrearRegistroFinancieroRequest request)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!await TieneAreaActiva(usuario))
            {
                return StatusCode(403, new
                {
                    mensaje = "El usuario no tiene un área activa."
                });
            }

            var descripcion = request.Descripcion?.Trim();

            if (string.IsNullOrWhiteSpace(descripcion))
            {
                return BadRequest(new
                {
                    mensaje = "La descripción es obligatoria."
                });
            }

            if (!request.FechaOperacion.HasValue ||
                !request.Monto.HasValue)
            {
                return BadRequest(new
                {
                    mensaje = "La fecha y el monto son obligatorios."
                });
            }

            var registro = new RegistroFinanciero
            {
                TipoOperacion = request.TipoOperacion,
                Descripcion = descripcion,
                FechaOperacion = request.FechaOperacion.Value,
                Monto = request.Monto.Value,
                AreaId = usuario.AreaId!.Value,
                UsuarioId = usuario.Id
            };

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            _context.RegistrosFinancieros.Add(registro);
            await _context.SaveChangesAsync();

            var historial = new HistorialAuditoria
            {
                FechaHora = DateTime.UtcNow,
                TipoAccion = "Creacion",
                UsuarioId = usuario.Id,
                RegistroFinancieroId = registro.RegistroFinancieroId,
                ValoresModificados = JsonSerializer.Serialize(new
                {
                    Anteriores = (object?)null,
                    Nuevos = new
                    {
                        registro.TipoOperacion,
                        registro.Descripcion,
                        registro.FechaOperacion,
                        registro.Monto,
                        registro.AreaId,
                        registro.UsuarioId
                    }
                })
            };

            _context.HistorialesAuditoria.Add(historial);
            await _context.SaveChangesAsync();

            await transaccion.CommitAsync();

            return StatusCode(201, new
            {
                mensaje = "Registro financiero creado correctamente.",
                registroId = registro.RegistroFinancieroId
            });
        }



        [HttpPut("{id:int}")]
        [Authorize(Roles = Roles.PersonalArea)]
        public async Task<IActionResult> ActualizarRegistro(
            int id,
            [FromBody] ActualizarRegistroFinancieroRequest request)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!await TieneAreaActiva(usuario))
            {
                return StatusCode(403, new
                {
                    mensaje = "El usuario no tiene un área activa."
                });
            }

            var descripcion = request.Descripcion?.Trim();

            if (string.IsNullOrWhiteSpace(descripcion))
            {
                return BadRequest(new
                {
                    mensaje = "La descripción es obligatoria."
                });
            }

            if (!request.FechaOperacion.HasValue ||
                !request.Monto.HasValue)
            {
                return BadRequest(new
                {
                    mensaje = "La fecha y el monto son obligatorios."
                });
            }

            byte[] versionRecibida;

            try
            {
                versionRecibida = Convert.FromBase64String(
                    request.RowVersion ?? string.Empty);
            }
            catch (FormatException)
            {
                return BadRequest(new
                {
                    mensaje = "La versión del registro no es válida."
                });
            }

            if (versionRecibida.Length != 8)
            {
                return BadRequest(new
                {
                    mensaje = "La versión del registro debe contener 8 bytes."
                });
            }

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            var registro = await _context.RegistrosFinancieros
                .FirstOrDefaultAsync(r =>
                    r.RegistroFinancieroId == id &&
                    r.AreaId == usuario.AreaId);

            if (registro == null)
            {
                return NotFound(new
                {
                    mensaje = "Registro financiero no encontrado."
                });
            }

            if (!registro.RowVersion.SequenceEqual(versionRecibida))
            {
                return Conflict(new
                {
                    mensaje = "El registro fue modificado por otro usuario. Consulte los datos actualizados antes de guardar."
                });
            }

            bool hayCambios =
                registro.TipoOperacion != request.TipoOperacion ||
                registro.Descripcion != descripcion ||
                registro.FechaOperacion != request.FechaOperacion.Value ||
                registro.Monto != request.Monto.Value;

            if (!hayCambios)
            {
                return Ok(new
                {
                    mensaje = "No se detectaron cambios en el registro financiero.",
                    registroId = registro.RegistroFinancieroId
                });
            }

            var valoresAnteriores = new
            {
                registro.TipoOperacion,
                registro.Descripcion,
                registro.FechaOperacion,
                registro.Monto
            };

            _context.Entry(registro)
                .Property(r => r.RowVersion)
                .OriginalValue = versionRecibida;

            registro.TipoOperacion = request.TipoOperacion;
            registro.Descripcion = descripcion;
            registro.FechaOperacion = request.FechaOperacion.Value;
            registro.Monto = request.Monto.Value;

            var historial = new HistorialAuditoria
            {
                FechaHora = DateTime.UtcNow,
                TipoAccion = "Modificacion",
                UsuarioId = usuario.Id,
                RegistroFinancieroId = registro.RegistroFinancieroId,
                ValoresModificados = JsonSerializer.Serialize(new
                {
                    Anteriores = valoresAnteriores,
                    Nuevos = new
                    {
                        registro.TipoOperacion,
                        registro.Descripcion,
                        registro.FechaOperacion,
                        registro.Monto
                    }
                })
            };

            _context.HistorialesAuditoria.Add(historial);

            try
            {
                await _context.SaveChangesAsync();
                await transaccion.CommitAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                await transaccion.RollbackAsync();

                return Conflict(new
                {
                    mensaje = "El registro fue modificado por otro usuario. Consulte los datos actualizados antes de guardar."
                });
            }

            return Ok(new
            {
                mensaje = "Registro financiero actualizado correctamente.",
                registroId = registro.RegistroFinancieroId,
                rowVersion = Convert.ToBase64String(registro.RowVersion)
            });
        }

        [HttpGet("exportar")]
        [Authorize(Roles = Roles.PersonalArea + "," +
                           Roles.JefeArea + "," +
                           Roles.Auditor)]
        public async Task<IActionResult> ExportarExcel()
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            var consulta = _context.RegistrosFinancieros
                .AsNoTracking()
                .AsQueryable();

            if (!User.IsInRole(Roles.Auditor))
            {
                if (!await TieneAreaActiva(usuario))
                {
                    return StatusCode(403, new
                    {
                        mensaje = "El usuario no tiene un area activa."
                    });
                }

                consulta = consulta.Where(
                    r => r.AreaId == usuario.AreaId);
            }

            var registros = await consulta
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
                $"CFA_RegistrosFinancieros_{DateTime.UtcNow:yyyyMMdd_HHmmss}.xlsx";

            await _bitacoraService.RegistrarAsync(
                new BitacoraActividad
                {
                    TipoActividad = "ExportacionExcel",
                    Resultado = "Exitoso",
                    UsuarioId = usuario.Id,
                    NombreUsuario = usuario.UserName ?? string.Empty,
                    AreaId = User.IsInRole(Roles.Auditor)
                        ? null
                        : usuario.AreaId,
                    DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    Detalle = $"Exportación general de registros financieros. Total de registros: {registros.Count}."
                });

            return File(
                contenido,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                nombreArchivo);
        }

        [HttpPost("importar/vista-previa")]
        [Authorize(Roles = Roles.PersonalArea)]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> VistaPreviaExcel(
            IFormFile archivo)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!await TieneAreaActiva(usuario))
            {
                return StatusCode(403, new
                {
                    mensaje = "El usuario no tiene un área activa."
                });
            }   

            if (archivo == null || archivo.Length == 0)
            {
                return BadRequest(new
                {
                    mensaje = "Debe seleccionar un archivo Excel."
                });
            }

            const long tamanoMaximo = 2 * 1024 * 1024;

            if (archivo.Length > tamanoMaximo)
            {
                return BadRequest(new
                {
                    mensaje = "El archivo supera el límite de 2 MB."
                });
            }

            if (!string.Equals(
                Path.GetExtension(archivo.FileName),
                ".xlsx",
                StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    mensaje = "Solo se permiten archivos .xlsx."
                });
            }

            try
            {

                await using var stream = archivo.OpenReadStream();
                using var memoria = new MemoryStream();

                await stream.CopyToAsync(memoria);

                byte[] contenido = memoria.ToArray();

                string hash = Convert.ToHexString(
                    SHA256.HashData(contenido));

                using var lectura = new MemoryStream(contenido);

                var resultado = _excelService.ValidarArchivo(lectura);

                resultado.HashArchivo = hash;

                return Ok(resultado);
            }
            catch (Exception ex) when (
                ex is System.IO.FileFormatException ||
                ex is System.IO.InvalidDataException ||
                ex is System.IO.IOException ||
                ex is System.Xml.XmlException)

            {
                return BadRequest(new
                {
                    mensaje = "El archivo Excel no tiene un formato válido."
                });
            }
        }


        [HttpPost("importar/confirmar")]
        [Authorize(Roles = Roles.PersonalArea)]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ConfirmarImportacion(
            IFormFile archivo,
            [FromForm] string hashArchivo)
        {
            var usuario = await ObtenerUsuarioActual();

            if (usuario == null)
                return Unauthorized();

            if (!await TieneAreaActiva(usuario))
            {
                return StatusCode(403, new
                {
                    mensaje = "El usuario no tiene un area activa."
                });
            }

            if (archivo == null || archivo.Length == 0)
            {
                return BadRequest(new
                {
                    mensaje = "Debe seleccionar un archivo Excel."
                });
            }

            const long tamanoMaximo = 2 * 1024 * 1024;

            if (archivo.Length > tamanoMaximo)
            {
                return BadRequest(new
                {
                    mensaje = "El archivo supera el limite de 2 MB."
                });
            }

            if (!string.Equals(
                Path.GetExtension(archivo.FileName),
                ".xlsx",
                StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    mensaje = "Solo se permiten archivos .xlsx."
                });
            }

            VistaPreviaExcelResponse resultado;
            string hashActual;

            try
            {
                await using var stream = archivo.OpenReadStream();
                using var memoria = new MemoryStream();

                await stream.CopyToAsync(memoria);

                byte[] contenido = memoria.ToArray();

                hashActual = Convert.ToHexString(
                    SHA256.HashData(contenido));

                if (string.IsNullOrWhiteSpace(hashArchivo) ||
                    !string.Equals(
                        hashActual,
                        hashArchivo.Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new
                    {
                        mensaje = "El archivo no coincide con la vista previa."
                    });
                }

                using var lectura = new MemoryStream(contenido);

                resultado = _excelService.ValidarArchivo(lectura);
            }

            catch (Exception ex) when (
                ex is System.IO.FileFormatException ||
                ex is System.IO.InvalidDataException ||
                ex is System.IO.IOException ||
                ex is System.Xml.XmlException)
            {
                return BadRequest(new
                {
                    mensaje = "El archivo Excel no tiene un formato valido."
                });
            }

            if (!resultado.EsValido)
            {
                return BadRequest(new
                {
                    mensaje = "El archivo contiene errores. No se importaron registros.",
                    errores = resultado.Errores
                });
            }

            var nombreArchivo = Path.GetFileName(
                archivo.FileName.Replace('\\', '/'));

            if (string.IsNullOrWhiteSpace(nombreArchivo) ||
                nombreArchivo.Length > 255)
            {
                return BadRequest(new
                {
                    mensaje = "El nombre del archivo no es valido o supera los 255 caracteres."
                });
            }

            var areaId = usuario.AreaId!.Value;

            await using var transaccion =
                await _context.Database.BeginTransactionAsync();

            var documento = new DocumentoFinanciero
            {
                NombreArchivo = nombreArchivo,
                AreaId = areaId,
                UsuarioId = usuario.Id,
                FechaImportacion = DateTime.UtcNow,
                HashArchivo = hashActual
            };

            _context.DocumentosFinancieros.Add(documento);

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateException ex)
                when (ex.InnerException is Microsoft.Data.SqlClient.SqlException sql &&
                      (sql.Number == 2601 || sql.Number == 2627))
            {
                await transaccion.RollbackAsync();

                return Conflict(new
                {
                    mensaje = "Este archivo Excel ya fue importado en el area.",
                });
            }

            var registros = resultado.Registros.Select(fila =>
                new RegistroFinanciero
                {
                    TipoOperacion = fila.TipoOperacion,
                    Descripcion = fila.Descripcion,
                    FechaOperacion = fila.FechaOperacion,
                    Monto = fila.Monto,
                    AreaId = areaId,
                    UsuarioId = usuario.Id,
                    DocumentoFinancieroId = documento.DocumentoFinancieroId
                }).ToList();

            _context.RegistrosFinancieros.AddRange(registros);

            await _context.SaveChangesAsync();

            var fechaAuditoria = DateTime.UtcNow;

            var historiales = registros.Select(registro =>
                new HistorialAuditoria
                {
                    FechaHora = fechaAuditoria,
                    TipoAccion = "Creacion",
                    UsuarioId = usuario.Id,
                    RegistroFinancieroId = registro.RegistroFinancieroId,
                    ValoresModificados = JsonSerializer.Serialize(new
                    {
                        Anteriores = (object?)null,
                        Nuevos = new
                        {
                            registro.TipoOperacion,
                            registro.Descripcion,
                            registro.FechaOperacion,
                            registro.Monto,
                            registro.AreaId,
                            registro.UsuarioId,
                            registro.DocumentoFinancieroId
                        }
                    })
                }).ToList();

            _context.HistorialesAuditoria.AddRange(historiales);

            await _context.SaveChangesAsync();

            _bitacoraService.PrepararRegistro(new BitacoraActividad
            {
                TipoActividad = "ImportacionExcel",
                Resultado = "Exitoso",
                UsuarioId = usuario.Id,
                NombreUsuario = usuario.UserName ?? string.Empty,
                AreaId = documento.AreaId,
                DocumentoFinancieroId = documento.DocumentoFinancieroId,
                NombreDocumento = documento.NombreArchivo,
                DireccionIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Detalle = $"Importación del documento {documento.NombreArchivo} " +
                          $"(ID: {documento.DocumentoFinancieroId}). " +
                          $"Total de registros importados: {registros.Count}."
            });

            await _context.SaveChangesAsync();

            await transaccion.CommitAsync();

            return Ok(new
            {
                mensaje = "Importacion realizada correctamente.",
                documentoFinancieroId = documento.DocumentoFinancieroId,
                nombreArchivo = documento.NombreArchivo,
                totalImportados = registros.Count,
                registrosIds = registros.Select(
                    r => r.RegistroFinancieroId).ToList()
            });
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
