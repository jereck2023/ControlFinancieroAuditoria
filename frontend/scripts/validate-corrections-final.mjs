// Isolated API process, existing test DB only. No credentials/JWT written or printed.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { xlsxEntries } from './testing/xlsx-inspection.mjs';
import { hiddenLines } from './testing/test-environment.mjs';
const run = `QA_FINAL_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const directory = new URL(`../docs/evidencias-validacion-final/${run}/`, import.meta.url);
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
  apiPort: 7297,
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
    const encoded = new Request('https://localhost:7297/api' + path, { method, body });
    bytes = Buffer.from(await encoded.arrayBuffer());
    type = encoded.headers.get('content-type');
  } else if (body) bytes = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: 7297,
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
    const match = path.match(/^\/usuarios\/(\d+)(?:\/(activar|desactivar|roles))?$/);
    must(
      (method === 'PATCH' && /^\/areas\/2025\/(activar|desactivar)$/.test(path)) ||
        (method === 'PUT' &&
          path === '/areas/2025' &&
          expected === 403 &&
          body.nombre === 'QA_EXP_B2_20261115045253_A') ||
        (method === 'PUT' &&
          match &&
          users.some((u) => u.id === Number(match[1])) &&
          (match[2] === 'activar' || match[2] === 'desactivar' || expected === 403)),
      'Mutation outside QA preparation blocked',
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

let sessions = [],
  baseline,
  historyBaseline,
  ruleBaseline,
  loginTrigger;
const sampleDirectory = new URL('../Excel-para-revision-manual/', directory);
mkdirSync(sampleDirectory, { recursive: true });
function fingerprint() {
  return sql(
    "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(RegistroFinancieroId,';',TipoOperacion,';',Descripcion,';',FechaOperacion,';',Monto,';',AreaId,';',UsuarioId,';',DocumentoFinancieroId,';',CONVERT(varchar(32),RowVersion,2))),N'|') WITHIN GROUP(ORDER BY RegistroFinancieroId)),2) FROM RegistrosFinancieros;",
  );
}
function historyHash() {
  return sql(
    "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(HistorialAuditoriaId,';',FechaHora,';',ValoresModificados)),N'|') WITHIN GROUP(ORDER BY HistorialAuditoriaId)),2) FROM HistorialesAuditoria;",
  );
}
function rules() {
  return sql(
    'SELECT Codigo,Activa,Umbral,VentanaMinutos,HoraInicio,HoraFin,DiasSemana FROM ReglasAnomalia ORDER BY Codigo FOR JSON PATH;',
  );
}
async function setup() {
  const qa = JSON.parse(
    sql(
      'SELECT Id,UserName,Activo,AreaId FROM AspNetUsers WHERE Id BETWEEN 3035 AND 3043 ORDER BY Id FOR JSON PATH;',
    ),
  );
  must(
    qa.length === 9 &&
      qa.every(
        (u) => !u.Activo && u.AreaId === 2025 && u.UserName.startsWith('qa_exp_b2_20261115045253.'),
      ),
    'QA account state mismatch',
  );
  must(
    Number(
      sql(
        "SELECT COUNT(*) FROM Areas WHERE AreaId=2025 AND Nombre='QA_EXP_B2_20261115045253_A' AND Activo=0;",
      ),
    ) === 1,
    'QA area state mismatch',
  );
  must(
    Number(
      sql("SELECT COUNT(*) FROM AspNetUsers WHERE AreaId=2025 AND UserName NOT LIKE 'qa[_]%';"),
    ) === 0,
    'Area contains non-QA accounts',
  );
  const roleData = JSON.parse(
    sql(
      'SELECT ur.UserId,r.Name FROM AspNetUserRoles ur JOIN AspNetRoles r ON r.Id=ur.RoleId WHERE ur.UserId BETWEEN 3035 AND 3043 FOR JSON PATH;',
    ),
  );
  users.push(
    ...qa.map((u) => ({
      id: u.Id,
      username: u.UserName,
      roles: roleData.filter((r) => r.UserId === u.Id).map((r) => r.Name),
    })),
  );
  areas.push(2025);
  baseline = fingerprint();
  historyBaseline = historyHash();
  ruleBaseline = rules();
  Object.assign(evidence, {
    financialHashBefore: baseline,
    historyHashBefore: historyBaseline,
    rulesBefore: JSON.parse(ruleBaseline),
  });
  save();
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(7297, '127.0.0.1', () => server.close(resolve));
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
    ASPNETCORE_URLS: 'https://localhost:7297',
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
      const socket = net.connect(7297, '127.0.0.1');
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

  await request('PATCH', '/areas/2025/activar', admin, null, 200);
  for (const user of users) {
    await request('PUT', '/usuarios/' + user.id + '/activar', admin, null, 200);
    sessions.push({ ...user, token: await login(user.username, qaSecret) });
  }
  loginTrigger = Number(
    sql(
      "SELECT MAX(BitacoraActividadId) FROM BitacorasActividades WHERE UsuarioId=3035 AND TipoActividad='LoginExitoso';",
    ),
  );
  const ownIds = JSON.parse(
    sql('SELECT Id FROM AspNetUsers WHERE AreaId=2025 ORDER BY Id FOR JSON PATH;'),
  ).map((u) => u.Id);
  const ownCount = Number(sql('SELECT COUNT(*) FROM RegistrosFinancieros WHERE AreaId=2025;')),
    globalCount = Number(sql('SELECT COUNT(*) FROM RegistrosFinancieros;'));
  const baseHeaders = ['TipoOperacion', 'Descripcion', 'FechaOperacion', 'Monto'];
  for (const session of sessions) {
    const isAdmin = session.roles.includes('Administrador'),
      auditor = session.roles.includes('Auditor'),
      jefe = session.roles.includes('JefeArea'),
      financial = auditor || jefe || session.roles.includes('PersonalArea');
    const catalog = await request(
      'GET',
      '/areas',
      session.token,
      null,
      isAdmin || auditor ? 200 : 403,
    );
    if (isAdmin || auditor)
      must(
        catalog.some((a) => a.areaId === 2025) && catalog.some((a) => a.areaId === 2026),
        'Areas catalog incomplete',
      );
    await request('GET', '/usuarios', session.token, null, isAdmin ? 200 : 403);
    const own = await request(
      'GET',
      '/usuarios/mi-area?areaId=2026&id=3044',
      session.token,
      null,
      jefe ? 200 : 403,
    );
    if (jefe) {
      must(
        JSON.stringify(own.map((u) => u.id).sort((a, b) => a - b)) === JSON.stringify(ownIds),
        'Own users scope incorrect',
      );
      must(
        own.every(
          (u) => Object.keys(u).sort().join(',') === 'activo,id,nombreCompleto,roles,userName',
        ),
        'Unexpected own-user fields',
      );
    }
    if (!isAdmin) {
      await request(
        'PUT',
        '/areas/2025',
        session.token,
        { nombre: 'QA_EXP_B2_20261115045253_A' },
        403,
      );
      await request('PUT', '/usuarios/3035/roles', session.token, { roles: ['PersonalArea'] }, 403);
    }
    const headers = auditor
      ? ['RegistroFinancieroId', ...baseHeaders, 'Area', 'UsuarioCreador']
      : jefe
        ? ['RegistroFinancieroId', ...baseHeaders, 'UsuarioCreador']
        : baseHeaders;
    for (const [mode, path] of [
      ['documento', '/documentos-financieros/2014/exportar'],
      ['registros', '/registros-financieros/exportar'],
    ]) {
      const result = await request('GET', path, session.token, null, financial ? 200 : 403);
      if (!financial) continue;
      const workbook = readWorkbook(result.bytes);
      must(
        JSON.stringify(workbook.headers) === JSON.stringify(headers) &&
          workbook.maxColumn === headers.length,
        'Role export columns incorrect',
      );
      must(
        workbook.rows.length === (mode === 'documento' ? 12 : auditor ? globalCount : ownCount),
        'Wrong exported scope',
      );
      const desc = headers.indexOf('Descripcion');
      if (!auditor)
        must(
          workbook.rows.every(
            (r) =>
              r[desc].startsWith('QA_EXP_B2_20261115045253 A ') ||
              r[desc].startsWith('QA_TIME_B4_20261115054933_'),
          ),
          'Foreign data in local export',
        );
      const ownRow = workbook.rows.find((r) => r[desc] === 'QA_EXP_B2_20261115045253 A FILA_01');
      must(
        ownRow &&
          Number(ownRow[headers.indexOf('Monto')]) === 1.01 &&
          Number(ownRow[headers.indexOf('FechaOperacion')]) ===
            Date.UTC(2026, 10, 14) / 86400000 + 25569,
        'Original values altered in Excel',
      );
      if (mode === 'documento' && [3035, 3036, 3037].includes(session.id)) {
        const file =
          session.id === 3035
            ? '01-personal-area-4-columnas.xlsx'
            : session.id === 3036
              ? '02-jefe-area-6-columnas.xlsx'
              : '03-auditor-7-columnas.xlsx';
        writeFileSync(new URL(file, sampleDirectory), result.bytes);
        record('manual-excel-prepared', { file, rows: 12, headers, openedInExcel: false });
      }
      record('export-passed', {
        roles: session.roles,
        mode,
        columns: headers.length,
        rows: workbook.rows.length,
      });
    }
    if (financial) {
      for (const [id, wanted] of [
        [21049, 1],
        [21061, auditor ? 1 : 0],
        [2147483647, 0],
      ]) {
        const found = await request(
          'GET',
          '/registros-financieros?registroFinancieroId=' + id,
          session.token,
          null,
          200,
        );
        must(
          found.length === wanted && found.every((r) => r.registroFinancieroId === id),
          'ID exactness or scope incorrect',
        );
      }
      const prefix = await request(
        'GET',
        '/registros-financieros?registroFinancieroId=2104',
        session.token,
        null,
        200,
      );
      must(
        prefix.every((r) => r.registroFinancieroId === 2104),
        'Partial match returned',
      );
    }
    await request(
      'GET',
      '/alertas?pagina=1&tamanoPagina=10&usuarioId=3035',
      session.token,
      null,
      auditor || jefe ? 200 : 403,
    );
    record('combined-role-passed', {
      id: session.id,
      roles: session.roles,
      areas: isAdmin || auditor,
      ownUsers: jefe,
      admin: isAdmin,
    });
  }
  const auditor = sessions.find((s) => s.id === 3037),
    jefe = sessions.find((s) => s.id === 3036);
  for (const route of ['historial-auditoria', 'bitacora-actividades']) {
    const scoped = await request(
      'GET',
      '/' + route + '?documentoFinancieroId=2015&pagina=1&tamanoPagina=10',
      jefe.token,
      null,
      200,
    );
    must(scoped.totalRegistros === 0, 'Foreign trace data visible to jefe');
    const global = await request(
      'GET',
      '/' + route + '?documentoFinancieroId=2015&pagina=1&tamanoPagina=10',
      auditor.token,
      null,
      200,
    );
    must(global.totalRegistros > 0, 'Auditor global trace denied');
    for (const [day, from, to] of [
      ['14', '2026-11-14T05:00:00', '2026-11-15T04:59:59'],
      ['15', '2026-11-15T05:00:00', '2026-11-16T04:59:59'],
    ]) {
      const data = await request(
        'GET',
        '/' +
          route +
          '?pagina=1&tamanoPagina=100&usuarioId=3035&fechaDesde=' +
          encodeURIComponent(from + '.0000000Z') +
          '&fechaHasta=' +
          encodeURIComponent(to + '.9999999Z'),
        auditor.token,
        null,
        200,
      );
      const table =
        route === 'historial-auditoria' ? 'HistorialesAuditoria' : 'BitacorasActividades';
      const count = Number(
        sql(
          'SELECT COUNT(*) FROM ' +
            table +
            " WHERE UsuarioId=3035 AND FechaHora>='" +
            from +
            ".0000000' AND FechaHora<='" +
            to +
            ".9999999';",
        ),
      );
      must(data.totalRegistros === count && count > 0, 'Peru date boundaries incorrect');
      record('peru-window-passed', { route, day, count });
    }
  }
  for (const session of [auditor, jefe])
    for (const type of ['resumen', 'detalle'])
      await request(
        'GET',
        '/reportes-financieros/' +
          type +
          '?fechaDesde=2026-11-14&fechaHasta=2026-11-14&areaId=2025&documentoFinancieroId=2014',
        session.token,
        null,
        200,
      );
  const links = JSON.parse(
    sql(
      'SELECT a.AlertaId,r.Codigo,a.RegistroFinancieroId,a.UsuarioId,a.EvidenciasJson FROM Alertas a JOIN ReglasAnomalia r ON r.ReglaAnomaliaId=a.ReglaAnomaliaId WHERE a.AlertaId IN (3257,3258,3259,3260,3266) ORDER BY a.AlertaId FOR JSON PATH;',
    ) || '[]',
  );
  must(
    links.length === 5 && new Set(links.map((a) => a.Codigo)).size === 3,
    'Prior automatic rule evidence missing',
  );
  record('three-rule-evidence-preserved', { alerts: links, notReexecuted: true });
  must(
    fingerprint() === baseline && historyHash() === historyBaseline,
    'Financial or audit history changed',
  );
  relay = http.createServer((incoming, outgoing) => {
    const isApi = incoming.url.startsWith('/api/');
    if (isApi) {
      try {
        verify();
        must(
          incoming.method === 'GET' || incoming.url === '/api/auth/login',
          'Browser mutation blocked',
        );
      } catch {
        outgoing.writeHead(403);
        outgoing.end();
        return;
      }
    }
    const upstream = (isApi ? https : http).request(
      {
        hostname: isApi ? 'localhost' : '127.0.0.1',
        port: isApi ? 7297 : 4200,
        path: incoming.url,
        method: incoming.method,
        rejectUnauthorized: isApi ? false : undefined,
        headers: { ...incoming.headers, host: isApi ? 'localhost:7297' : '127.0.0.1:4200' },
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
    relay.listen(4310, '127.0.0.1', resolve);
  });
  console.log(
    JSON.stringify({
      run,
      ready: true,
      browser: 'http://localhost:4310/login',
      samples: sampleDirectory.pathname,
      users: users.map((u) => ({ id: u.id, username: u.username, roles: u.roles })),
    }),
  );
}
async function periodicCheck() {
  for (let n = 0; n < 50; n++) {
    verify();
    const rows = JSON.parse(
      sql(
        "SELECT a.AlertaId,a.EvidenciasJson,a.FechaHoraDeteccion FROM Alertas a JOIN ReglasAnomalia r ON r.ReglaAnomaliaId=a.ReglaAnomaliaId WHERE r.Codigo='FUERA_DE_HORARIO' AND a.UsuarioId=3035 AND JSON_VALUE(a.EvidenciasJson,'$.BitacoraActividadId')='" +
          loginTrigger +
          "' FOR JSON PATH;",
      ) || '[]',
    );
    if (rows.length) {
      must(rules() === ruleBaseline, 'Rule configuration changed');
      record('periodic-runtime-passed', { loginTrigger, alerts: rows, manualDetectionCalls: 0 });
      console.log(
        'Proceso periódico comprobado con una alerta de acceso QA nueva; evidencias financieras y otras reglas conservadas.',
      );
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('No periodic alert for this QA login');
}
async function cleanup() {
  admin = await login('admin', adminSecret);
  for (const user of users)
    await request('PUT', '/usuarios/' + user.id + '/desactivar', admin, null, 200);
  await request('PATCH', '/areas/2025/desactivar', admin, null, 200);
  must(
    Number(sql('SELECT COUNT(*) FROM AspNetUsers WHERE Id BETWEEN 3035 AND 3043 AND Activo=1;')) ===
      0,
    'QA accounts active',
  );
  must(
    Number(sql('SELECT COUNT(*) FROM Areas WHERE AreaId=2025 AND Activo=1;')) === 0,
    'QA area active',
  );
  must(
    fingerprint() === baseline && historyHash() === historyBaseline && rules() === ruleBaseline,
    'Data or rules changed',
  );
  record('cleanup-passed', {
    qaInactive: true,
    financialDataUnchanged: true,
    historicalDataUnchanged: true,
    rulesUnchanged: true,
    financialHashAfter: fingerprint(),
    historyHashAfter: historyHash(),
  });
}
try {
  console.log('Credenciales por dos líneas ocultas: admin y QA.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  await setup();
  await periodicCheck();
  while ((await input.read()) !== 'cleanup') {}
  await cleanup();
  evidence.passed = true;
  save();
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
