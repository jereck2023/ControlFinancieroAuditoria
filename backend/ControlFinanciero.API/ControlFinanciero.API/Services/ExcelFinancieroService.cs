using ClosedXML.Excel;
using ControlFinanciero.API.DTOs;
using System.Globalization;

namespace ControlFinanciero.API.Services
{
    public class ExcelFinancieroService
    {
        public VistaPreviaExcelResponse ValidarArchivo(Stream archivo)
        {
            var resultado = new VistaPreviaExcelResponse();

            using var libro = new XLWorkbook(archivo);

            var hoja = libro.Worksheets
                .FirstOrDefault(h => h.Name == "RegistrosFinancieros");

            if (hoja == null)
            {
                resultado.Errores.Add(new ErrorExcelFinanciero
                {
                    NumeroFila = 0,
                    Mensaje = "No existe la hoja RegistrosFinancieros."
                });

                return resultado;
            }

            var celdaFormula = hoja
                .CellsUsed(XLCellsUsedOptions.AllContents)
                .FirstOrDefault(c => c.HasFormula);

            if (celdaFormula != null)
            {
                resultado.Errores.Add(new ErrorExcelFinanciero
                {
                    NumeroFila = celdaFormula.Address.RowNumber,
                    Mensaje = $"No se permiten formulas en la plantilla. Celda: {celdaFormula.Address}."
                });

                return resultado;
            }


            string[] encabezados =
            {
                "TipoOperacion",
                "Descripcion",
                "FechaOperacion",
                "Monto"
            };

            for (int columna = 1; columna <= encabezados.Length; columna++)
            {
                if (hoja.Cell(1, columna).GetString().Trim()
                    != encabezados[columna - 1])
                {
                    resultado.Errores.Add(new ErrorExcelFinanciero
                    {
                        NumeroFila = 1,
                        Mensaje = $"Encabezado incorrecto en columna {columna}."
                    });
                }
            }

            if (hoja.LastColumnUsed()?.ColumnNumber() > 4)
            {
                resultado.Errores.Add(new ErrorExcelFinanciero
                {
                    NumeroFila = 1,
                    Mensaje = "La plantilla solo permite cuatro columnas."
                });
            }

            if (resultado.Errores.Count > 0)
                return resultado;


            foreach (var filaExcel in hoja.RowsUsed(XLCellsUsedOptions.AllContents))
            {
                int fila = filaExcel.RowNumber();

                if (fila == 1)
                    continue;

                var tipo = hoja.Cell(fila, 1).GetString().Trim();
                var descripcion = hoja.Cell(fila, 2).GetString().Trim();
                var celdaFecha = hoja.Cell(fila, 3);
                var celdaMonto = hoja.Cell(fila, 4);

                if (tipo == "" && descripcion == "" &&
                    celdaFecha.IsEmpty() && celdaMonto.IsEmpty())
                    continue;

                resultado.TotalFilas++;

                if (resultado.TotalFilas > 500)
                {
                    resultado.Errores.Add(new ErrorExcelFinanciero
                    {
                        NumeroFila = fila,
                        Mensaje = "El archivo supera los 500 registros."
                    });
                    break;
                }

                var erroresFila = new List<string>();

                if (tipo != "Ingreso" && tipo != "Egreso")
                    erroresFila.Add("TipoOperacion debe ser Ingreso o Egreso.");

                if (string.IsNullOrWhiteSpace(descripcion) ||
                    descripcion.Length > 250)
                    erroresFila.Add("Descripcion debe tener entre 1 y 250 caracteres.");

                DateTime fecha = default;
                bool fechaValida = false;

                if (celdaFecha.DataType == XLDataType.DateTime)
                {
                    fechaValida = celdaFecha.TryGetValue(out fecha);
                }
                else if (celdaFecha.DataType == XLDataType.Text)
                {
                    fechaValida = DateTime.TryParseExact(
                        celdaFecha.GetString().Trim(),
                        "dd/MM/yyyy",
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out fecha);
                }

                if (!fechaValida)
                    erroresFila.Add("FechaOperacion debe ser una fecha valida.");

                decimal monto = 0;

                bool montoValido =
                    celdaMonto.DataType == XLDataType.Number &&
                    celdaMonto.TryGetValue(out monto) &&
                    monto > 0 &&
                    monto <= 9999999999999999.99m &&
                    decimal.Round(monto, 2) == monto;

                if (!montoValido)
                    erroresFila.Add("Monto debe ser positivo y tener maximo dos decimales.");

                if (erroresFila.Count > 0)
                {
                    foreach (var error in erroresFila)
                    {
                        resultado.Errores.Add(new ErrorExcelFinanciero
                        {
                            NumeroFila = fila,
                            Mensaje = error
                        });
                    }

                    continue;
                }

                resultado.Registros.Add(new FilaExcelFinanciero
                {
                    NumeroFila = fila,
                    TipoOperacion = tipo,
                    Descripcion = descripcion,
                    FechaOperacion = DateOnly.FromDateTime(fecha),
                    Monto = monto
                });
            }

            if (resultado.TotalFilas == 0)
            {
                resultado.Errores.Add(new ErrorExcelFinanciero
                {
                    NumeroFila = 0,
                    Mensaje = "El archivo no contiene registros financieros."
                });
            }

            return resultado;
        }


        public byte[] GenerarExcel(
            List<RegistroFinancieroResponse> registros, PerfilExportacionFinanciera perfil)
        {
            using var libro = new XLWorkbook();

            var hoja = libro.Worksheets.Add("RegistrosFinancieros");

            bool incluirId = perfil != PerfilExportacionFinanciera.PersonalArea;
            bool incluirArea = perfil == PerfilExportacionFinanciera.Auditor;
            var columnas = new List<string>();
            if (incluirId) columnas.Add("RegistroFinancieroId");
            columnas.AddRange(new[] { "TipoOperacion", "Descripcion", "FechaOperacion", "Monto" });
            if (incluirArea) columnas.Add("Area");
            if (incluirId) columnas.Add("UsuarioCreador");
            string[] encabezados = columnas.ToArray();

            for (int columna = 0; columna < encabezados.Length; columna++)
            {
                hoja.Cell(1, columna + 1).Value = encabezados[columna];
            }

            var encabezado = hoja.Range(1, 1, 1, encabezados.Length);
            encabezado.Style.Font.Bold = true;
            encabezado.Style.Fill.BackgroundColor = XLColor.LightBlue;

            int fila = 2;

            foreach (var registro in registros)
            {
                int columna = 1;
                if (incluirId) hoja.Cell(fila, columna++).Value = registro.RegistroFinancieroId;
                hoja.Cell(fila, columna++).Value = registro.TipoOperacion;
                hoja.Cell(fila, columna++).Value = registro.Descripcion;

                hoja.Cell(fila, columna).Value =
                    registro.FechaOperacion.ToDateTime(TimeOnly.MinValue);
                hoja.Cell(fila, columna++).Style.DateFormat.Format = "dd/mm/yyyy";
                hoja.Cell(fila, columna).Value = registro.Monto;
                hoja.Cell(fila, columna++).Style.NumberFormat.Format = "#,##0.00";
                if (incluirArea) hoja.Cell(fila, columna++).Value = registro.NombreArea;
                if (incluirId) hoja.Cell(fila, columna).Value = registro.NombreUsuario;

                fila++;
            }

            hoja.Columns().AdjustToContents();

            using var memoria = new MemoryStream();

            libro.SaveAs(memoria);

            return memoria.ToArray();
        }

        public byte[] GenerarExcelResumen(ResumenFinancieroResponse reporte)
        {
            using var libro = new XLWorkbook();
            var hoja = libro.Worksheets.Add("Resumen Financiero");

            hoja.Cell(1, 1).Value = "REPORTE DE RESUMEN FINANCIERO";
            hoja.Range(1, 1, 1, 7).Merge();
            hoja.Cell(1, 1).Style.Font.Bold = true;
            hoja.Cell(1, 1).Style.Font.FontSize = 16;

            hoja.Cell(2, 1).Value = "Fecha de generación (UTC)";
            hoja.Cell(2, 2).Value = DateTime.UtcNow;
            hoja.Cell(2, 2).Style.DateFormat.Format = "dd/mm/yyyy hh:mm";

            hoja.Cell(3, 1).Value = "Fecha desde";
            hoja.Cell(3, 2).Value =
                reporte.FiltrosAplicados.FechaDesde!.Value.ToDateTime(TimeOnly.MinValue);
            hoja.Cell(3, 2).Style.DateFormat.Format = "dd/mm/yyyy";

            hoja.Cell(4, 1).Value = "Fecha hasta";
            hoja.Cell(4, 2).Value =
                reporte.FiltrosAplicados.FechaHasta!.Value.ToDateTime(TimeOnly.MinValue);
            hoja.Cell(4, 2).Style.DateFormat.Format = "dd/mm/yyyy";

            hoja.Cell(5, 1).Value = "Tipo de operación";
            hoja.Cell(5, 2).Value =
                reporte.FiltrosAplicados.TipoOperacion ?? "Todos";

            hoja.Cell(6, 1).Value = "Área";
            hoja.Cell(6, 2).Value =
                reporte.FiltrosAplicados.AreaId?.ToString() ?? "Todas las autorizadas";

            hoja.Cell(7, 1).Value = "Documento";
            hoja.Cell(7, 2).Value = reporte.FiltrosAplicados.SoloSinDocumento
                ? "Sin documento de origen"
                : reporte.FiltrosAplicados.DocumentoFinancieroId?.ToString() ?? "Todos";

            hoja.Cell(8, 1).Value = "Agrupación";
            hoja.Cell(8, 2).Value = reporte.Agrupacion;

            hoja.Cell(10, 1).Value = "Cantidad de ingresos";
            hoja.Cell(10, 2).Value = reporte.CantidadIngresos;

            hoja.Cell(11, 1).Value = "Total de ingresos";
            hoja.Cell(11, 2).Value = reporte.TotalIngresos;

            hoja.Cell(12, 1).Value = "Cantidad de egresos";
            hoja.Cell(12, 2).Value = reporte.CantidadEgresos;

            hoja.Cell(13, 1).Value = "Total de egresos";
            hoja.Cell(13, 2).Value = reporte.TotalEgresos;

            hoja.Cell(14, 1).Value = "Diferencia";
            hoja.Cell(14, 2).Value = reporte.Diferencia;

            hoja.Range(11, 2, 11, 2).Style.NumberFormat.Format = "#,##0.00";
            hoja.Range(13, 2, 14, 2).Style.NumberFormat.Format = "#,##0.00";

            hoja.Cell(16, 1).Value =
                "La diferencia representa ingresos menos egresos registrados. No constituye saldo disponible ni presupuesto restante.";

            if (reporte.Agrupacion != "Ninguna")
            {
                string[] encabezados =
                {
            "GrupoId", "Grupo", "CantidadIngresos", "TotalIngresos",
            "CantidadEgresos", "TotalEgresos", "Diferencia"
        };

                for (int columna = 0; columna < encabezados.Length; columna++)
                    hoja.Cell(18, columna + 1).Value = encabezados[columna];

                var encabezado = hoja.Range(18, 1, 18, 7);
                encabezado.Style.Font.Bold = true;
                encabezado.Style.Fill.BackgroundColor = XLColor.LightBlue;

                int fila = 19;

                foreach (var grupo in reporte.Grupos)
                {
                    if (grupo.GrupoId.HasValue)
                        hoja.Cell(fila, 1).Value = grupo.GrupoId.Value;

                    hoja.Cell(fila, 2).Value = grupo.NombreGrupo;
                    hoja.Cell(fila, 3).Value = grupo.CantidadIngresos;
                    hoja.Cell(fila, 4).Value = grupo.TotalIngresos;
                    hoja.Cell(fila, 5).Value = grupo.CantidadEgresos;
                    hoja.Cell(fila, 6).Value = grupo.TotalEgresos;
                    hoja.Cell(fila, 7).Value = grupo.Diferencia;

                    hoja.Range(fila, 4, fila, 4).Style.NumberFormat.Format = "#,##0.00";
                    hoja.Range(fila, 6, fila, 7).Style.NumberFormat.Format = "#,##0.00";

                    fila++;
                }
            }

            hoja.Columns().AdjustToContents();

            using var memoria = new MemoryStream();
            libro.SaveAs(memoria);

            return memoria.ToArray();
        }

        public byte[] GenerarExcelDetalle(DetalleFinancieroResponse reporte)
        {
            using var libro = new XLWorkbook();
            var hoja = libro.Worksheets.Add("Detalle Financiero");

            hoja.Cell(1, 1).Value = "REPORTE DE DETALLE FINANCIERO";
            hoja.Range(1, 1, 1, 8).Merge();
            hoja.Cell(1, 1).Style.Font.Bold = true;
            hoja.Cell(1, 1).Style.Font.FontSize = 16;

            hoja.Cell(2, 1).Value = "Fecha de generación (UTC)";
            hoja.Cell(2, 2).Value = DateTime.UtcNow;
            hoja.Cell(2, 2).Style.DateFormat.Format = "dd/mm/yyyy hh:mm";

            hoja.Cell(3, 1).Value = "Fecha desde";
            hoja.Cell(3, 2).Value =
                reporte.FiltrosAplicados.FechaDesde!.Value.ToDateTime(TimeOnly.MinValue);
            hoja.Cell(3, 2).Style.DateFormat.Format = "dd/mm/yyyy";

            hoja.Cell(4, 1).Value = "Fecha hasta";
            hoja.Cell(4, 2).Value =
                reporte.FiltrosAplicados.FechaHasta!.Value.ToDateTime(TimeOnly.MinValue);
            hoja.Cell(4, 2).Style.DateFormat.Format = "dd/mm/yyyy";

            hoja.Cell(5, 1).Value = "Tipo de operación";
            hoja.Cell(5, 2).Value =
                reporte.FiltrosAplicados.TipoOperacion ?? "Todos";

            hoja.Cell(6, 1).Value = "Área";
            hoja.Cell(6, 2).Value =
                reporte.FiltrosAplicados.AreaId?.ToString() ?? "Todas las autorizadas";

            hoja.Cell(7, 1).Value = "Documento";
            hoja.Cell(7, 2).Value = reporte.FiltrosAplicados.SoloSinDocumento
                ? "Sin documento de origen"
                : reporte.FiltrosAplicados.DocumentoFinancieroId?.ToString() ?? "Todos";

            hoja.Cell(8, 1).Value = "Total de registros";
            hoja.Cell(8, 2).Value = reporte.TotalRegistros;

            hoja.Cell(10, 1).Value =
                "Este reporte contiene los valores actuales de los registros financieros.";

            string[] encabezados =
            {
        "RegistroFinancieroId",
        "FechaOperacion",
        "TipoOperacion",
        "Descripcion",
        "Monto",
        "Area",
        "UsuarioCreador",
        "DocumentoOrigen"
    };

            for (int columna = 0; columna < encabezados.Length; columna++)
                hoja.Cell(12, columna + 1).Value = encabezados[columna];

            var encabezado = hoja.Range(12, 1, 12, encabezados.Length);
            encabezado.Style.Font.Bold = true;
            encabezado.Style.Fill.BackgroundColor = XLColor.LightBlue;

            int fila = 13;

            foreach (var registro in reporte.Registros)
            {
                hoja.Cell(fila, 1).Value = registro.RegistroFinancieroId;

                hoja.Cell(fila, 2).Value =
                    registro.FechaOperacion.ToDateTime(TimeOnly.MinValue);
                hoja.Cell(fila, 2).Style.DateFormat.Format = "dd/mm/yyyy";

                hoja.Cell(fila, 3).Value = registro.TipoOperacion;
                hoja.Cell(fila, 4).Value = registro.Descripcion;

                hoja.Cell(fila, 5).Value = registro.Monto;
                hoja.Cell(fila, 5).Style.NumberFormat.Format = "#,##0.00";

                hoja.Cell(fila, 6).Value = registro.NombreArea;
                hoja.Cell(fila, 7).Value = registro.NombreUsuario;
                hoja.Cell(fila, 8).Value = registro.NombreDocumento;

                fila++;
            }

            if (reporte.Registros.Count == 0)
                hoja.Cell(13, 1).Value =
                    "No existen movimientos para los filtros seleccionados.";

            hoja.SheetView.FreezeRows(12);
            hoja.Columns().AdjustToContents();

            using var memoria = new MemoryStream();
            libro.SaveAs(memoria);

            return memoria.ToArray();
        }
    }
}
