// Isolated API process, existing test DB only. No credentials/JWT written or printed.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { makeXlsx } from './testing/xlsx-fixture.mjs';
import { xlsxEntries } from './testing/xlsx-inspection.mjs';
import { hiddenLines } from './testing/test-environment.mjs';
const run = `QA_EXP_B2_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const directory = new URL(`../docs/evidencias-exportaciones-bloque-2/${run}/`, import.meta.url);
mkdirSync(directory, { recursive: true });
const input = hiddenLines(),
  users = [],
  areas = [];
let api,
  relay,
  admin = '',
  qaSecret = '',
  adminSecret = '',
  failed = false;
const evidence = {
  run,
  database: 'ControlFinancieroDB_Pruebas',
  apiPort: 7294,
  events: [],
  users,
  areas,
};
const save = () =>
  writeFileSync(new URL('resultado.json', directory), JSON.stringify(evidence, null, 2));
function record(type, data) {
  evidence.events.push({ utc: new Date().toISOString(), type, ...data });
  save();
}
function must(ok, message) {
  if (!ok) throw new Error(message);
}
function sql(query) {
  return execFileSync(
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
      '-f',
      '65001',
      '-Q',
      `SET NOCOUNT ON; ${query}`,
    ],
    { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
  ).trim();
}
function verify() {
  must(api && !api.killed && api.exitCode === null, 'Isolated API not running');
  const rows = JSON.parse(
    sql(
      `SELECT DISTINCT DB_NAME(database_id) AS db,program_name AS app FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=${api.pid} FOR JSON PATH;`,
    ),
  );
  must(
    rows.length > 0 && rows.every((r) => r.db === 'ControlFinancieroDB_Pruebas' && r.app === run),
    'API connection scope mismatch',
  );
  record('connection-verified', { pid: api.pid, database: 'ControlFinancieroDB_Pruebas' });
}
async function raw(method, path, token, body) {
  let bytes = null,
    type = 'application/json';
  if (body instanceof FormData) {
    const encoded = new Request('https://localhost:7294/api' + path, { method, body });
    bytes = Buffer.from(await encoded.arrayBuffer());
    type = encoded.headers.get('content-type');
  } else if (body) bytes = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: 7294,
        path: '/api' + path,
        method,
        rejectUnauthorized: false,
        headers: {
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(bytes ? { 'Content-Type': type, 'Content-Length': bytes.length } : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const bytes = Buffer.concat(chunks),
            type = res.headers['content-type'] || '';
          const data = type.includes('json') && bytes.length ? JSON.parse(bytes.toString()) : null;
          resolve({ status: res.statusCode, data, bytes, type });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('Request timeout')));
    req.end(bytes);
  });
}
async function request(method, path, token, body, expected) {
  verify();
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    const area = path.match(/^\/areas\/(\d+)(?:\/(activar|desactivar))?$/),
      user = path.match(
        /^\/usuarios\/(\d+)(?:\/(activar|desactivar|roles|restablecer-password))?$/,
      );
    must(
      (/^\/registros-financieros\/importar\/(vista-previa|confirmar)$/.test(path) &&
        body instanceof FormData) ||
        (path === '/areas' && body.nombre.startsWith(run)) ||
        (path === '/usuarios' && body.nombreUsuario.startsWith(run.toLowerCase())) ||
        (area && areas.includes(+area[1])) ||
        (user && users.some((u) => u.id === +user[1])),
      'Non-QA mutation blocked',
    );
  }
  const r = await raw(method, path, token, body);
  record('http', { method, path, status: r.status, expected });
  must(
    r.status === expected,
    `Unexpected HTTP ${r.status} at ${method} ${path}; expected ${expected}`,
  );
  return r.type.includes('spreadsheetml') ? r : r.data;
}
async function login(username, password) {
  return (await request('POST', '/auth/login', null, { username, password }, 200)).token;
}
async function createUser(label, roles, areaId, active = true) {
  const username = `${run.toLowerCase()}.${label}`,
    initial = 'Aa1!' + randomUUID();
  const made = await request(
    'POST',
    '/usuarios',
    admin,
    {
      nombreUsuario: username,
      nombreCompleto: `${run} ${label}`,
      passwordInicial: initial,
      areaId,
      roles,
    },
    201,
  );
  const user = { label, id: made.usuario.id, username, roles, areaId, active };
  users.push(user);
  save();
  const first = await login(username, initial);
  await request(
    'POST',
    '/auth/cambiar-password',
    first,
    { passwordActual: initial, passwordNueva: qaSecret },
    200,
  );
  const token = await login(username, qaSecret);
  if (!active) await request('PUT', `/usuarios/${user.id}/desactivar`, admin, null, 200);
  return { ...user, token };
}
const cases = [
  ['personal', ['PersonalArea']],
  ['jefe', ['JefeArea']],
  ['auditor', ['Auditor']],
  ['administrador', ['Administrador']],
  ['admin_personal', ['Administrador', 'PersonalArea']],
  ['admin_jefe', ['Administrador', 'JefeArea']],
  ['admin_auditor', ['Administrador', 'Auditor']],
  ['personal_jefe', ['PersonalArea', 'JefeArea']],
  ['jefe_auditor', ['JefeArea', 'Auditor']],
];
const baseHeaders = ['TipoOperacion', 'Descripcion', 'FechaOperacion', 'Monto'];
let sessions = [],
  documentA,
  documentB,
  targetId,
  foreignId,
  baseline;
function fingerprint() {
  return sql(
    `SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(RegistroFinancieroId,';',TipoOperacion,';',Descripcion,';',FechaOperacion,';',Monto,';',AreaId,';',UsuarioId,';',DocumentoFinancieroId,';',CONVERT(varchar(32),RowVersion,2))),N'|') WITHIN GROUP(ORDER BY RegistroFinancieroId)),2) FROM RegistrosFinancieros WHERE UsuarioId NOT IN (${users.map((u) => u.id).join(',')});`,
  );
}
function readWorkbook(bytes) {
  const files = xlsxEntries(bytes),
    plain = (x) => x.replace(/(<\/?)[A-Za-z_][\w.-]*:/g, '$1');
  const decode = (x) =>
    x
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  const shared = [
    ...plain(files.get('xl/sharedStrings.xml') || '').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g),
  ].map((m) =>
    [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((t) => decode(t[1])).join(''),
  );
  let maxColumn = 0;
  const rows = [];
  for (const row of plain(files.get('xl/worksheets/sheet1.xml')).matchAll(
    /<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g,
  )) {
    const cells = [];
    for (const cell of row[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const letters = cell[1].match(/\br="([A-Z]+)\d+"/)[1];
      let column = 0;
      for (const c of letters) column = column * 26 + c.charCodeAt(0) - 64;
      maxColumn = Math.max(maxColumn, column);
      const value = cell[2].match(/<v>([\s\S]*?)<\/v>/)?.[1];
      cells[column - 1] = /\bt="s"/.test(cell[1])
        ? shared[+value]
        : /\bt="inlineStr"/.test(cell[1])
          ? decode(cell[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || '')
          : value;
    }
    rows.push(cells);
  }
  return { headers: rows[0], rows: rows.slice(1), maxColumn };
}
function form(bytes, name, hash) {
  const data = new FormData();
  data.append('archivo', new Blob([bytes]), name);
  if (hash) data.append('hashArchivo', hash);
  return data;
}
async function importFile(session, label, size) {
  const rows = Array.from({ length: size }, (_, i) => [
    i % 2 ? 'Egreso' : 'Ingreso',
    `${run} ${label} FILA_${String(i + 1).padStart(2, '0')}`,
    '14/11/2026',
    Number((1.01 + i / 100).toFixed(2)),
  ]);
  const name = `${run}_${label}.xlsx`,
    bytes = makeXlsx(rows);
  writeFileSync(new URL(name, directory), bytes);
  const preview = await request(
    'POST',
    '/registros-financieros/importar/vista-previa',
    session.token,
    form(bytes, name),
    200,
  );
  must(preview.esValido && preview.totalFilas === size, 'Invalid fixture import');
  const imported = await request(
    'POST',
    '/registros-financieros/importar/confirmar',
    session.token,
    form(bytes, name, preview.hashArchivo),
    200,
  );
  must(imported.totalImportados === size, 'Wrong imported count');
  record('import-passed', {
    documentId: imported.documentoFinancieroId,
    rows: size,
    firstId: imported.registrosIds[0],
    lastId: imported.registrosIds.at(-1),
  });
  return imported;
}
async function setup() {
  must(
    Number(
      sql(
        "SELECT COUNT(*) FROM AspNetRoles WHERE Name IN ('Administrador','Auditor','JefeArea','PersonalArea');",
      ),
    ) === 4,
    'Roles not prepared',
  );
  must(
    Number(sql("SELECT COUNT(*) FROM AspNetUsers WHERE UserName='admin' AND Activo=1;")) === 1,
    'Existing admin unavailable',
  );
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(7294, '127.0.0.1', () => server.close(resolve));
  });
  const env = { ...process.env };
  for (const k of Object.keys(env))
    if (/^(ConnectionStrings|Jwt|AdminInicial|ASPNETCORE_|DOTNET_ENVIRONMENT)/i.test(k))
      delete env[k];
  Object.assign(env, {
    ConnectionStrings__DefaultConnection: `Server=localhost;Database=ControlFinancieroDB_Pruebas;Trusted_Connection=True;TrustServerCertificate=True;Application Name=${run}`,
    Jwt__Key: randomBytes(48).toString('hex'),
    Jwt__Issuer: run,
    Jwt__Audience: run,
    Jwt__ExpirationMinutes: '30',
    AdminInicial__Username: 'admin',
    AdminInicial__Password: adminSecret,
    ASPNETCORE_URLS: 'https://localhost:7294',
    ASPNETCORE_ENVIRONMENT: 'Production',
    DOTNET_ENVIRONMENT: 'Production',
    Logging__LogLevel__Default: 'None',
  });
  api = spawn('dotnet', ['bin/Release/net9.0/ControlFinanciero.API.dll'], {
    cwd: new URL('../../backend/ControlFinanciero.API/ControlFinanciero.API/', import.meta.url),
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  let listening = false;
  for (let i = 0; i < 100; i++) {
    must(api.exitCode === null, 'API exited');
    listening = await new Promise((resolve) => {
      const socket = net.connect(7294, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (listening) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  must(listening, 'API unavailable');
  verify();
  admin = await login('admin', adminSecret);
  for (const suffix of ['A', 'B'])
    areas.push(
      (await request('POST', '/areas', admin, { nombre: run + '_' + suffix }, 201)).areaId,
    );
  for (const [label, roles] of cases) sessions.push(await createUser(label, roles, areas[0]));
  const foreign = await createUser('otra_area', ['PersonalArea'], areas[1]);
  baseline = fingerprint();
  const importedA = await importFile(sessions[0], 'A', 12),
    importedB = await importFile(foreign, 'B', 2);
  documentA = importedA.documentoFinancieroId;
  documentB = importedB.documentoFinancieroId;
  targetId = importedA.registrosIds[0];
  foreignId = importedB.registrosIds[0];
  Object.assign(evidence, { documentA, documentB, targetId, foreignId, baseline });
  save();
  let personalExport;
  for (const session of sessions) {
    const financial = session.roles.some((r) =>
        ['PersonalArea', 'JefeArea', 'Auditor'].includes(r),
      ),
      auditor = session.roles.includes('Auditor'),
      jefe = !auditor && session.roles.includes('JefeArea');
    const headers = auditor
      ? ['RegistroFinancieroId', ...baseHeaders, 'Area', 'UsuarioCreador']
      : jefe
        ? ['RegistroFinancieroId', ...baseHeaders, 'UsuarioCreador']
        : baseHeaders;
    for (const [mode, path] of [
      ['documento', `/documentos-financieros/${documentA}/exportar`],
      ['registros', '/registros-financieros/exportar'],
    ]) {
      const exported = await request('GET', path, session.token, null, financial ? 200 : 403);
      if (!financial) continue;
      const workbook = readWorkbook(exported.bytes);
      must(
        JSON.stringify(workbook.headers) === JSON.stringify(headers) &&
          workbook.maxColumn === headers.length,
        'Wrong role columns ' + session.label + ' ' + mode,
      );
      if (!auditor || mode === 'documento')
        must(workbook.rows.length === 12, 'Unexpected exported scope');
      const descIndex = headers.indexOf('Descripcion'),
        own = workbook.rows.find((row) => row[descIndex] === `${run} A FILA_01`);
      must(own, 'Own record not exported');
      must(
        own[headers.indexOf('TipoOperacion')] === 'Ingreso' &&
          Number(own[headers.indexOf('Monto')]).toFixed(2) === '1.01' &&
          Number(own[headers.indexOf('FechaOperacion')]) ===
            Date.UTC(2026, 10, 14) / 86400000 + 25569,
        'Financial data altered',
      );
      if (headers.includes('RegistroFinancieroId'))
        must(Number(own[0]) === targetId, 'Wrong ID in export');
      if (headers.includes('UsuarioCreador'))
        must(own[headers.indexOf('UsuarioCreador')] === run + ' personal', 'Wrong creator');
      if (auditor) must(own[headers.indexOf('Area')] === run + '_A', 'Wrong area');
      if (!auditor)
        must(
          workbook.rows.every((row) => row[descIndex].startsWith(run + ' A ')),
          'Foreign-area export leaked',
        );
      if (mode === 'registros' && auditor)
        must(
          workbook.rows.some((row) => row[descIndex] === run + ' B FILA_01'),
          'Auditor global scope lost',
        );
      writeFileSync(new URL(`${session.label}-${mode}.xlsx`, directory), exported.bytes);
      if (session.label === 'personal' && mode === 'documento') personalExport = exported.bytes;
      record('export-passed', {
        roles: session.roles,
        label: session.label,
        mode,
        columns: headers,
        rows: workbook.rows.length,
        http: 200,
      });
    }
    if (financial) {
      const own = await request(
        'GET',
        `/registros-financieros?registroFinancieroId=${targetId}`,
        session.token,
        null,
        200,
      );
      must(own.length === 1 && own[0].registroFinancieroId === targetId, 'ID not exact');
      const other = await request(
        'GET',
        `/registros-financieros?registroFinancieroId=${foreignId}`,
        session.token,
        null,
        200,
      );
      must(other.length === (auditor ? 1 : 0), 'Foreign ID escaped scope');
      const missing = await request(
        'GET',
        '/registros-financieros?registroFinancieroId=2147483647',
        session.token,
        null,
        200,
      );
      must(missing.length === 0, 'Nonexistent ID unexpectedly found');
      const prefix = Number(String(targetId).slice(0, -1));
      const partial = await request(
        'GET',
        `/registros-financieros?registroFinancieroId=${prefix}`,
        session.token,
        null,
        200,
      );
      must(
        partial.every((r) => r.registroFinancieroId === prefix) &&
          !partial.some((r) => r.registroFinancieroId === targetId),
        'Partial ID match',
      );
      await request(
        'GET',
        `/registros-financieros/${foreignId}`,
        session.token,
        null,
        auditor ? 200 : 404,
      );
      await request(
        'GET',
        `/documentos-financieros/${documentB}/exportar`,
        session.token,
        null,
        auditor ? 200 : 404,
      );
      record('id-scope-passed', {
        label: session.label,
        roles: session.roles,
        targetId,
        foreignVisible: auditor,
        partialMatches: false,
      });
    } else record('admin-only-denied', { http: 403, modalities: 2 });
  }
  const personal = sessions[0];
  for (const value of ['0', '-1', '2147483648', 'abc'])
    await request(
      'GET',
      `/registros-financieros?registroFinancieroId=${value}`,
      personal.token,
      null,
      400,
    );
  const roundtrip = await request(
    'POST',
    '/registros-financieros/importar/vista-previa',
    personal.token,
    form(personalExport, run + '_roundtrip.xlsx'),
    200,
  );
  must(roundtrip.esValido && roundtrip.totalFilas === 12, 'Personal export no longer imports');
  record('personal-format-import-compatible', { rows: 12, confirmedAgain: false });
  for (const label of ['jefe', 'auditor']) {
    const bytes = (await import('node:fs')).readFileSync(
      new URL(`${label}-documento.xlsx`, directory),
    );
    const preview = await request(
      'POST',
      '/registros-financieros/importar/vista-previa',
      personal.token,
      form(bytes, label + '.xlsx'),
      200,
    );
    must(!preview.esValido, 'Expanded export incorrectly accepted as import template');
    record('expanded-export-rejected-by-unchanged-import', { label, valid: false });
  }
  const list = await request('GET', '/documentos-financieros', personal.token, null, 200);
  must(
    list.some((d) => d.documentoFinancieroId === documentA) &&
      !list.some((d) => d.documentoFinancieroId === documentB),
    'Document scope changed',
  );
  const records = await request(
    'GET',
    `/documentos-financieros/${documentA}/registros`,
    personal.token,
    null,
    200,
  );
  must(records.length === 12, 'Document records changed');
  must(fingerprint() === baseline, 'Original financial data changed');
  record('api-checks-completed', { roleCases: cases.length, originalDataUnchanged: true });
  relay = http.createServer((incoming, outgoing) => {
    const isApi = incoming.url.startsWith('/api/');
    if (isApi) {
      try {
        verify();
      } catch {
        outgoing.writeHead(503);
        outgoing.end();
        return;
      }
    }
    const upstream = (isApi ? https : http).request(
      {
        hostname: 'localhost',
        port: isApi ? 7294 : 4200,
        path: incoming.url,
        method: incoming.method,
        rejectUnauthorized: isApi ? false : undefined,
        headers: { ...incoming.headers, host: isApi ? 'localhost:7294' : 'localhost:4200' },
      },
      (response) => {
        outgoing.writeHead(response.statusCode, response.headers);
        response.pipe(outgoing);
        if (isApi) record('browser-http', { path: incoming.url, status: response.statusCode });
      },
    );
    upstream.on('error', () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(upstream);
  });
  await new Promise((resolve, reject) => {
    relay.once('error', reject);
    relay.listen(4307, '127.0.0.1', resolve);
  });
  console.log(
    JSON.stringify({
      run,
      username: personal.username,
      targetId,
      foreignId,
      documentA,
      areaId: areas[0],
      browser: 'http://localhost:4307/login',
    }),
  );
}
async function cleanup() {
  must(fingerprint() === baseline, 'Original financial data changed before cleanup');
  for (const user of users)
    await request('PUT', `/usuarios/${user.id}/desactivar`, admin, null, 200);
  for (const area of areas) await request('PATCH', `/areas/${area}/desactivar`, admin, null, 200);
  must(
    Number(
      sql(
        `SELECT COUNT(*) FROM AspNetUsers WHERE Id IN (${users.map((u) => u.id).join(',')}) AND Activo=1;`,
      ),
    ) === 0,
    'QA users active',
  );
  must(
    Number(sql(`SELECT COUNT(*) FROM Areas WHERE AreaId IN (${areas.join(',')}) AND Activo=1;`)) ===
      0,
    'QA areas active',
  );
  record('cleanup-passed', {
    usersInactive: users.length,
    areasInactive: areas.length,
    financialRowsRetained: 14,
    documentsRetained: 2,
    originalDataUnchanged: fingerprint() === baseline,
  });
}
try {
  console.log('Credenciales por dos líneas ocultas: admin y QA.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  await setup();
  while (true) {
    const command = await input.read();
    if (command === 'cleanup') {
      await cleanup();
      evidence.passed = true;
      save();
      break;
    }
  }
} catch (error) {
  failed = true;
  record('error', { message: error.message });
  console.log('DETENIDO: ' + error.message);
  process.exitCode = 1;
} finally {
  if (relay?.listening) {
    relay.closeAllConnections();
    relay.close();
  }
  if (api && !api.killed) api.kill();
  input.close();
  admin = '';
  qaSecret = '';
  adminSecret = '';
  sessions = [];
  record('isolated-process-stopped', { pid: api?.pid, failed });
}
