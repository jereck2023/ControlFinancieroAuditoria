// Read-only evidence for the identified QA run. No authentication secrets are queried.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { verifyTestDatabase } from './test-environment.mjs';
verifyTestDatabase();
const directory = new URL('../../docs/evidencias-bloque-2/', import.meta.url);
const run = 'QA_B2_20261112095714';
function sql(query) {
  verifyTestDatabase();
  return JSON.parse(
    execFileSync(
      'sqlcmd',
      [
        '-S',
        'localhost',
        '-E',
        '-d',
        'ControlFinancieroDB_Pruebas',
        '-b',
        '-h',
        '-1',
        '-y',
        '4000',
        '-Q',
        `SET NOCOUNT ON; ${query} FOR JSON PATH;`,
      ],
      { encoding: 'utf8', windowsHide: true },
    ).trim(),
  );
}
const records = sql(
  `SELECT COUNT(*) registros,COUNT(DISTINCT Descripcion) descripciones,COUNT(DISTINCT TRY_CONVERT(int,RIGHT(Descripcion,4))) indices,MIN(RegistroFinancieroId) primerId,MAX(RegistroFinancieroId) ultimoId,SUM(Monto) total,SUM(CASE WHEN AreaId=24 AND DocumentoFinancieroId=12 AND FechaOperacion='2026-11-12' AND Descripcion='${run} O5 FILA_'+RIGHT('0000'+CONVERT(varchar(4),TRY_CONVERT(int,RIGHT(Descripcion,4))),4) AND TRY_CONVERT(int,RIGHT(Descripcion,4)) BETWEEN 1 AND 500 AND Monto=CAST(TRY_CONVERT(int,RIGHT(Descripcion,4)) AS decimal(18,2))/100 AND TipoOperacion=CASE WHEN TRY_CONVERT(int,RIGHT(Descripcion,4))%2=1 THEN 'Ingreso' ELSE 'Egreso' END THEN 1 ELSE 0 END) coincidenciasExactas FROM RegistrosFinancieros WHERE UsuarioId=1028`,
)[0];
const documents = sql(
  'SELECT DocumentoFinancieroId,UsuarioId,AreaId,NombreArchivo,HashArchivo FROM DocumentosFinancieros WHERE UsuarioId=1028',
);
const history = sql(
  'SELECT COUNT(*) historiales FROM HistorialesAuditoria WHERE UsuarioId=1028',
)[0];
const review = sql(
  "SELECT BitacoraActividadId,TipoActividad,Resultado,CONVERT(varchar(40),FechaHora,126) fechaUTC,Detalle FROM BitacorasActividades WHERE UsuarioId=1029 AND TipoActividad='InicioRevisionAlerta'",
);
const alert = sql(
  'SELECT AlertaId,Estado,UsuarioRevisionId,CONVERT(varchar(40),FechaInicioRevisionUtc,126) fechaRevisionUTC FROM Alertas WHERE AlertaId=142',
)[0];
const hash = createHash('sha256')
  .update(readFileSync(new URL(`${run}_O5_500.xlsx`, directory)))
  .digest('hex')
  .toUpperCase();
if (
  records.registros !== 500 ||
  records.descripciones !== 500 ||
  records.indices !== 500 ||
  records.coincidenciasExactas !== 500 ||
  records.total !== 1252.5 ||
  history.historiales !== 500 ||
  documents.length !== 1 ||
  documents[0].DocumentoFinancieroId !== 12 ||
  documents[0].HashArchivo !== hash
)
  throw new Error('O5 correspondencia exacta no acreditada.');
if (
  review.length !== 1 ||
  review[0].Resultado !== 'Exitoso' ||
  !review[0].Detalle.startsWith('AlertaId=142;') ||
  alert.Estado !== 'En revision' ||
  alert.UsuarioRevisionId !== 1029
)
  throw new Error('O8 transición única no acreditada.');
const evidence = {
  checkedUTC: new Date().toISOString(),
  database: 'ControlFinancieroDB_Pruebas',
  run,
  records,
  documents,
  history,
  review,
  alert,
};
writeFileSync(new URL('persistencia.json', directory), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence));
