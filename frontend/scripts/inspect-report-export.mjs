import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
import { xlsxEntries } from './testing/xlsx-inspection.mjs';
const input = hiddenLines();
console.log('Proporcione usuario QA y contraseña por dos líneas ocultas. No se guardarán.');
try {
  const username = await input.read();
  let password = await input.read();
  if (!/^qa_m7_\d+\.reportes$/.test(username))
    throw new Error('Se requiere una cuenta QA de esta validación.');
  const areaId = Number(process.argv[2]);
  if (!Number.isSafeInteger(areaId) || areaId < 1) throw new Error('Se requiere el ID de área QA.');
  verifyTestDatabase();
  const login = await fetch('http://localhost:4200/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  password = '';
  const session = await login.json();
  if (login.status !== 200 || !session.token) throw new Error('No se pudo preparar la sesión QA.');
  const query = new URLSearchParams({
    fechaDesde: '2026-11-11',
    fechaHasta: '2026-11-11',
    areaId: String(areaId),
  });
  verifyTestDatabase();
  const detail = await fetch(`http://localhost:4200/api/reportes-financieros/detalle?${query}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  const data = JSON.parse(await detail.text(), (key, value, context) =>
    key === 'monto' && typeof value === 'number' ? context.source : value,
  );
  if (detail.status !== 200 || !Array.isArray(data.registros))
    throw new Error('No se pudo consultar el detalle QA.');
  const maximum = data.registros.find((row) => row.monto === '9999999999999999.99');
  if (!maximum) throw new Error('No se encontró el importe máximo QA.');
  verifyTestDatabase();
  const exported = await fetch(
    `http://localhost:4200/api/reportes-financieros/detalle/exportar?${query}`,
    { headers: { Authorization: `Bearer ${session.token}` } },
  );
  if (exported.status !== 200) throw new Error('No se pudo inspeccionar la exportación QA.');
  const entries = xlsxEntries(Buffer.from(await exported.arrayBuffer()));
  const xml = entries.get('xl/worksheets/sheet1.xml');
  const row = [
    ...xml.matchAll(/<(?:\w+:)?row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g),
  ].find((match) =>
    new RegExp(
      `<(?:\\w+:)?c\\b[^>]*r="A${match[1]}"[^>]*>[\\s\\S]*?<(?:\\w+:)?v>${maximum.registroFinancieroId}</(?:\\w+:)?v>`,
    ).test(match[2]),
  );
  if (!row) throw new Error('Registro máximo no encontrado en el Excel.');
  const cell = row[2].match(
    new RegExp(
      `<(?:\\w+:)?c\\b[^>]*r="E${row[1]}"[^>]*>[\\s\\S]*?<(?:\\w+:)?v>([^<]+)</(?:\\w+:)?v>`,
    ),
  )?.[1];
  if (!cell) throw new Error('Celda de monto no encontrada en el Excel.');
  console.log(
    JSON.stringify({
      inspeccionExcelReal: true,
      importeAPI: maximum.monto,
      importeEnCeldaExcel: cell,
      precisionExactaConservada: cell === maximum.monto,
    }),
  );
  session.token = '';
} catch (error) {
  console.log(error instanceof Error ? error.message : 'No se pudo inspeccionar el archivo.');
  process.exitCode = 1;
} finally {
  input.close();
}
