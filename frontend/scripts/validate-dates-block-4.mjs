// Isolated API process, existing test DB only. No credentials/JWT written or printed.
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { hiddenLines } from './testing/test-environment.mjs';
const resume = process.argv.includes('--resume');
const run = resume
  ? 'QA_TIME_B4_20261115054933'
  : `QA_TIME_B4_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const directory = new URL(`../docs/evidencias-fechas-bloque-4/${run}/`, import.meta.url);
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
const evidence = resume
  ? JSON.parse(readFileSync(new URL('resultado.json', directory), 'utf8'))
  : {
      run,
      database: 'ControlFinancieroDB_Pruebas',
      apiPort: 7296,
      events: [],
      users,
      areas,
    };
if (resume) {
  users.push(...evidence.users);
  areas.push(...evidence.areas);
  evidence.users = users;
  evidence.areas = areas;
  delete evidence.passed;
}
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
    const encoded = new Request('https://localhost:7296/api' + path, { method, body });
    bytes = Buffer.from(await encoded.arrayBuffer());
    type = encoded.headers.get('content-type');
  } else if (body) bytes = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: 7296,
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
    const uid = path.match(/^\/usuarios\/(\d+)\/(activar|desactivar)$/),
      rid = path.match(/^\/registros-financieros\/(\d+)$/);
    must(
      (method === 'PATCH' && /^\/areas\/2025\/(activar|desactivar)$/.test(path)) ||
        (method === 'PUT' && uid && users.some((u) => u.id === Number(uid[1]))) ||
        (method === 'POST' &&
          path === '/usuarios' &&
          body.nombreUsuario.startsWith(run.toLowerCase())) ||
        (method === 'POST' &&
          path === '/registros-financieros' &&
          body.descripcion.startsWith(run)) ||
        (method === 'PUT' &&
          rid &&
          newRecordId === Number(rid[1]) &&
          body.descripcion.startsWith(run)),
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

let sessions = [],
  newRecordId = null,
  oldHistoryMax,
  oldHistoryHash,
  oldFinanceHash,
  ruleBaseline,
  loginUserId;
function financeHash() {
  return sql(
    "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(RegistroFinancieroId,';',Descripcion,';',FechaOperacion,';',Monto,';',CONVERT(varchar(32),RowVersion,2))),N'|') WITHIN GROUP(ORDER BY RegistroFinancieroId)),2) FROM RegistrosFinancieros" +
      (newRecordId ? ' WHERE RegistroFinancieroId<>' + newRecordId : '') +
      ';',
  );
}
function historyHash() {
  return sql(
    "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(HistorialAuditoriaId,';',FechaHora,';',ValoresModificados)),N'|') WITHIN GROUP(ORDER BY HistorialAuditoriaId)),2) FROM HistorialesAuditoria WHERE HistorialAuditoriaId<=" +
      oldHistoryMax +
      ';',
  );
}
function rules() {
  return sql(
    'SELECT Codigo,Activa,Umbral,VentanaMinutos,HoraInicio,HoraFin,DiasSemana FROM ReglasAnomalia ORDER BY Codigo FOR JSON PATH;',
  );
}
async function dateTests(auditor) {
  for (const [route, table, id] of [
    ['historial-auditoria', 'HistorialesAuditoria', 'HistorialAuditoriaId'],
    ['bitacora-actividades', 'BitacorasActividades', 'BitacoraActividadId'],
  ]) {
    for (const [day, from, until] of [
      ['14/11/2026', '2026-11-14T05:00:00', '2026-11-15T04:59:59'],
      ['15/11/2026', '2026-11-15T05:00:00', '2026-11-16T04:59:59'],
    ]) {
      const fromUTC = from + '.0000000Z',
        untilUTC = until + '.9999999Z';
      const response = await request(
        'GET',
        '/' +
          route +
          '?usuarioId=3035&pagina=1&tamanoPagina=100&fechaDesde=' +
          encodeURIComponent(fromUTC) +
          '&fechaHasta=' +
          encodeURIComponent(untilUTC),
        auditor.token,
        null,
        200,
      );
      const expected = Number(
        sql(
          'SELECT COUNT(*) FROM ' +
            table +
            " WHERE UsuarioId=3035 AND FechaHora>='" +
            from +
            ".0000000' AND FechaHora<='" +
            until +
            ".9999999';",
        ),
      );
      must(
        response.totalRegistros === expected && expected > 0,
        'Date filter mismatch ' + route + ' ' + day,
      );
      must(
        response.registros.every((r) => {
          const value = new Date(r.fechaHora + 'Z');
          return value >= new Date(fromUTC) && value <= new Date(untilUTC);
        }),
        'Date out of requested window',
      );
      record('peru-day-filter-passed', {
        route,
        day,
        fromUTC,
        untilUTC,
        count: expected,
        ids: response.registros.map((r) => r[id]),
      });
    }
  }
  const h = await request('GET', '/historial-auditoria/11079', auditor.token, null, 200);
  const b = await request('GET', '/bitacora-actividades/3952', auditor.token, null, 200);
  for (const [kind, item, table, idKey, id] of [
    ['history', h, 'HistorialesAuditoria', 'HistorialAuditoriaId', 11079],
    ['activity', b, 'BitacorasActividades', 'BitacoraActividadId', 3952],
  ]) {
    const stored = sql(
      'SELECT CONVERT(varchar(33),FechaHora,126) FROM ' +
        table +
        ' WHERE ' +
        idKey +
        '=' +
        id +
        ';',
    );
    must(stored.slice(0, 19) === item.fechaHora.slice(0, 19), 'Stored event date changed');
    record('stored-api-date-matched', {
      kind,
      id,
      sqlUtc: stored,
      apiUtc: item.fechaHora,
      peru: new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(item.fechaHora + 'Z')),
    });
  }
}
async function startApi() {
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
    ASPNETCORE_URLS: 'https://localhost:7296',
    ASPNETCORE_ENVIRONMENT: 'Production',
    DOTNET_ENVIRONMENT: 'Production',
    Logging__LogLevel__Default: 'None',
  });
  env['Logging__LogLevel__ControlFinanciero.API.Services.DeteccionAnomaliasWorker'] = 'Information';
  api = spawn('dotnet', ['bin/Release/net9.0/ControlFinanciero.API.dll'], {
    cwd: new URL('../../backend/ControlFinanciero.API/ControlFinanciero.API/', import.meta.url),
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  let listening = false;
  for (let i = 0; i < 100; i++) {
    must(api.exitCode === null, 'API exited');
    listening = await new Promise((resolve) => {
      const socket = net.connect(7296, '127.0.0.1');
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

  let workerOutput = '';
  api.stdout.on('data', (chunk) => {
    workerOutput += chunk.toString();
    for (const m of workerOutput.matchAll(/Deteccion automatica: (\d+) alertas nuevas\./g))
      record('worker-generated', { count: Number(m[1]), pid: api.pid });
    workerOutput = workerOutput.split('\n').at(-1);
  });
}
async function startRelay() {
  relay = http.createServer((incoming, outgoing) => {
    const isApi = incoming.url.startsWith('/api/');
    if (isApi) {
      try {
        verify();
        must(!incoming.url.startsWith('/api/anomalias'), 'Manual endpoint blocked in test relay');
      } catch {
        outgoing.writeHead(503);
        outgoing.end();
        return;
      }
    }
    const upstream = (isApi ? https : http).request(
      {
        hostname: isApi ? 'localhost' : '127.0.0.1',
        port: isApi ? 7296 : 4200,
        path: incoming.url,
        method: incoming.method,
        rejectUnauthorized: isApi ? false : undefined,
        headers: { ...incoming.headers, host: isApi ? 'localhost:7296' : '127.0.0.1:4200' },
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
    relay.listen(4309, '127.0.0.1', resolve);
  });
  console.log(
    JSON.stringify({
      run,
      browser: 'http://localhost:4309/login',
      recordId: newRecordId,
      users: users.slice(0, 3),
    }),
  );
}
async function setup() {
  if (resume) {
    newRecordId = evidence.newRecordId;
    loginUserId = users.find((u) => u.username.startsWith(run.toLowerCase())).id;
    must(
      newRecordId === 21063 &&
        Number(
          sql(
            "SELECT COUNT(*) FROM RegistrosFinancieros WHERE RegistroFinancieroId=21063 AND Descripcion='" +
              run +
              "_CAMBIO_3' AND AreaId=2025;",
          ),
        ) === 1,
      'Resume QA record mismatch',
    );
    must(
      Number(
        sql(
          'SELECT COUNT(*) FROM AspNetUsers WHERE Id IN (' +
            users.map((u) => u.id).join(',') +
            ') AND Activo=1 AND AreaId=2025;',
        ),
      ) === 4,
      'Resume accounts mismatch',
    );
    oldHistoryMax = Number(
      sql(
        'SELECT MIN(HistorialAuditoriaId)-1 FROM HistorialesAuditoria WHERE RegistroFinancieroId=21063;',
      ),
    );
    oldHistoryHash = historyHash();
    oldFinanceHash = financeHash();
    ruleBaseline = rules();
    await startApi();
    record('resumed-existing-data', { newRecordId, loginUserId, noRepeatedWrites: true });
    await startRelay();
    return;
  }

  const area = JSON.parse(
    sql('SELECT AreaId,Nombre,Activo FROM Areas WHERE AreaId=2025 FOR JSON PATH;'),
  )[0];
  must(area?.Nombre === 'QA_EXP_B2_20261115045253_A' && !area.Activo, 'QA area changed');
  const qa = JSON.parse(
    sql(
      'SELECT Id,UserName,Activo,AreaId FROM AspNetUsers WHERE Id IN (3035,3036,3037) ORDER BY Id FOR JSON PATH;',
    ),
  );
  must(
    qa.length === 3 &&
      qa.every(
        (u) => u.UserName.startsWith('qa_exp_b2_20261115045253.') && !u.Activo && u.AreaId === 2025,
      ),
    'QA accounts mismatch',
  );
  users.push(...qa.map((u) => ({ id: u.Id, username: u.UserName })));
  areas.push(2025);
  oldHistoryMax = Number(sql('SELECT MAX(HistorialAuditoriaId) FROM HistorialesAuditoria;'));
  oldHistoryHash = historyHash();
  oldFinanceHash = financeHash();
  ruleBaseline = rules();
  must(
    JSON.parse(ruleBaseline).length === 3 && JSON.parse(ruleBaseline).every((r) => r.Activa),
    'Expected three active rules',
  );
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(7296, '127.0.0.1', () => server.close(resolve));
  });
  await startApi();
  await request('PATCH', '/areas/2025/activar', admin, null, 200);
  for (const user of users) {
    await request('PUT', '/usuarios/' + user.id + '/activar', admin, null, 200);
    sessions.push({ ...user, token: await login(user.username, qaSecret) });
  }
  const personal = sessions[0],
    auditor = sessions[2];
  const temporary = await request(
    'POST',
    '/usuarios',
    admin,
    {
      nombreUsuario: run.toLowerCase() + '.login',
      nombreCompleto: run + ' LOGIN',
      passwordInicial: 'Aa1!' + randomUUID(),
      areaId: 2025,
      roles: ['PersonalArea'],
    },
    201,
  );
  loginUserId = temporary.usuario.id;
  users.push({ id: loginUserId, username: run.toLowerCase() + '.login' });
  save();
  const base = {
    tipoOperacion: 'Ingreso',
    descripcion: run + '_CREADO',
    fechaOperacion: '2026-11-15',
    monto: 1.01,
  };
  newRecordId = (await request('POST', '/registros-financieros', personal.token, base, 201))
    .registroId;
  must(Number.isInteger(newRecordId), 'Missing QA record');
  evidence.newRecordId = newRecordId;
  save();
  for (let n = 1; n <= 3; n++) {
    const current = await request(
      'GET',
      '/registros-financieros/' + newRecordId,
      personal.token,
      null,
      200,
    );
    await request(
      'PUT',
      '/registros-financieros/' + newRecordId,
      personal.token,
      { ...base, descripcion: run + '_CAMBIO_' + n, rowVersion: current.rowVersion },
      200,
    );
  }
  const bad = 'Wrong1!' + randomUUID();
  for (let n = 0; n < 5; n++)
    await request(
      'POST',
      '/auth/login',
      null,
      { username: run.toLowerCase() + '.login', password: bad },
      401,
    );
  await dateTests(auditor);
  must(
    historyHash() === oldHistoryHash && financeHash() === oldFinanceHash,
    'Existing data changed',
  );
  await startRelay();
}
async function automatic() {
  for (let attempt = 0; attempt < 70; attempt++) {
    verify();
    const alerts = JSON.parse(
      sql(
        'SELECT a.AlertaId,r.Codigo,a.RegistroFinancieroId,a.UsuarioId,a.CampoModificado,a.EvidenciasJson,a.FechaHoraEvento,a.FechaHoraDeteccion FROM Alertas a JOIN ReglasAnomalia r ON r.ReglaAnomaliaId=a.ReglaAnomaliaId WHERE a.RegistroFinancieroId=' +
          newRecordId +
          ' OR a.UsuarioId=' +
          loginUserId +
          ' FOR JSON PATH;',
      ) || '[]',
    );
    if (
      ['MODIFICACION_REITERADA', 'FUERA_DE_HORARIO', 'LOGIN_FALLIDO_REITERADO'].every((c) =>
        alerts.some((a) => a.Codigo === c),
      )
    ) {
      const histories = JSON.parse(
        sql(
          'SELECT HistorialAuditoriaId FROM HistorialesAuditoria WHERE RegistroFinancieroId=' +
            newRecordId +
            " AND TipoAccion='Modificacion' FOR JSON PATH;",
        ),
      );
      const ids = histories.map((h) => h.HistorialAuditoriaId);
      must(
        alerts.some(
          (a) =>
            a.Codigo === 'FUERA_DE_HORARIO' &&
            ids.includes(JSON.parse(a.EvidenciasJson).HistorialAuditoriaId),
        ),
        'No financial outside-hours evidence',
      );
      const repeated = alerts.find((a) => a.Codigo === 'MODIFICACION_REITERADA');
      must(
        JSON.parse(repeated.EvidenciasJson).HistorialesAuditoriaId.every((id) => ids.includes(id)),
        'Unrelated financial evidence',
      );
      must(rules() === ruleBaseline, 'Rule parameters changed');
      record('automatic-three-rules-passed', {
        alerts,
        histories,
        ruleParameters: JSON.parse(ruleBaseline),
        manualCalls: 0,
      });
      console.log('Tres reglas verificadas mediante detección automática y SQL.');
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Automatic alerts incomplete after controlled wait');
}
async function cleanup() {
  admin = await login('admin', adminSecret);
  for (const user of users)
    await request('PUT', '/usuarios/' + user.id + '/desactivar', admin, null, 200);
  await request('PATCH', '/areas/2025/desactivar', admin, null, 200);
  must(
    Number(
      sql(
        'SELECT COUNT(*) FROM AspNetUsers WHERE Id IN (' +
          users.map((u) => u.id).join(',') +
          ') AND Activo=1;',
      ),
    ) === 0,
    'QA users active',
  );
  must(
    Number(sql('SELECT COUNT(*) FROM Areas WHERE AreaId=2025 AND Activo=1;')) === 0,
    'QA area active',
  );
  must(
    historyHash() === oldHistoryHash &&
      financeHash() === oldFinanceHash &&
      rules() === ruleBaseline,
    'Original data or rules changed',
  );
  record('cleanup-passed', {
    qaInactive: true,
    originalHistoricalEventsUnchanged: true,
    originalFinancialDataUnchanged: true,
    rulesUnchanged: true,
    newRecordRetained: newRecordId,
  });
}
try {
  console.log('Credenciales por dos líneas ocultas: admin y QA.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  await setup();
  await automatic();
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
  adminSecret = '';
  qaSecret = '';
  sessions = [];
  record('isolated-process-stopped', { pid: api?.pid, failed });
}
