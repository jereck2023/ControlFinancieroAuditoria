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
            List<RegistroFinancieroResponse> registros)
        {
            using var libro = new XLWorkbook();

            var hoja = libro.Worksheets.Add("RegistrosFinancieros");

            string[] encabezados =
            {
        "RegistroFinancieroId",
        "TipoOperacion",
        "Descripcion",
        "FechaOperacion",
        "Monto",
        "Area",
        "UsuarioCreador"
    };

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
                hoja.Cell(fila, 1).Value = registro.RegistroFinancieroId;
                hoja.Cell(fila, 2).Value = registro.TipoOperacion;
                hoja.Cell(fila, 3).Value = registro.Descripcion;

                hoja.Cell(fila, 4).Value =
                    registro.FechaOperacion.ToDateTime(TimeOnly.MinValue);

                hoja.Cell(fila, 4).Style.DateFormat.Format = "dd/mm/yyyy";

                hoja.Cell(fila, 5).Value = registro.Monto;
                hoja.Cell(fila, 5).Style.NumberFormat.Format = "#,##0.00";

                hoja.Cell(fila, 6).Value = registro.NombreArea;
                hoja.Cell(fila, 7).Value = registro.NombreUsuario;

                fila++;
            }

            hoja.Columns().AdjustToContents();

            using var memoria = new MemoryStream();

            libro.SaveAs(memoria);

            return memoria.ToArray();
        }
    }
}
