// Isolated API process, existing test DB only. No credentials/JWT written or printed.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { hiddenLines } from './testing/test-environment.mjs';
const run = `QA_UI_B3_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const directory = new URL(`../docs/evidencias-presentacion-bloque-3/${run}/`, import.meta.url);
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
  apiPort: 7295,
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
    const encoded = new Request('https://localhost:7295/api' + path, { method, body });
    bytes = Buffer.from(await encoded.arrayBuffer());
    type = encoded.headers.get('content-type');
  } else if (body) bytes = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: 7295,
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
    must(
      (method === 'PATCH' && /^\/areas\/2025\/(activar|desactivar)$/.test(path)) ||
        (method === 'PUT' && /^\/usuarios\/(3036|3037)\/(activar|desactivar)$/.test(path)),
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

let sessions = [];
function fingerprint() {
  return sql(
    "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(RegistroFinancieroId,';',Descripcion,';',FechaOperacion,';',Monto,';',AreaId,';',UsuarioId,';',DocumentoFinancieroId,';',CONVERT(varchar(32),RowVersion,2))),N'|') WITHIN GROUP(ORDER BY RegistroFinancieroId)),2) FROM RegistrosFinancieros;",
  );
}
let baseline;
async function setup() {
  const area = JSON.parse(
    sql('SELECT AreaId,Nombre,Activo FROM Areas WHERE AreaId=2025 FOR JSON PATH;'),
  )[0];
  must(
    area?.Nombre === 'QA_EXP_B2_20261115045253_A' && !area.Activo,
    'Original QA area state changed',
  );
  const qa = JSON.parse(
    sql(
      'SELECT Id,UserName,Activo,AreaId FROM AspNetUsers WHERE Id IN (3036,3037) ORDER BY Id FOR JSON PATH;',
    ),
  );
  must(
    qa.length === 2 &&
      qa.every(
        (u) => u.UserName.startsWith('qa_exp_b2_20261115045253.') && !u.Activo && u.AreaId === 2025,
      ),
    'QA accounts mismatch',
  );
  areas.push(2025);
  users.push(...qa.map((u) => ({ id: u.Id, username: u.UserName })));
  baseline = fingerprint();
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(7295, '127.0.0.1', () => server.close(resolve));
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
    ASPNETCORE_URLS: 'https://localhost:7295',
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
      const socket = net.connect(7295, '127.0.0.1');
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
  const [jefe, auditor] = sessions;
  for (const [name, session] of [
    ['jefe', jefe],
    ['auditor', auditor],
  ]) {
    for (const route of ['historial-auditoria', 'bitacora-actividades']) {
      const own = await request(
        'GET',
        '/' + route + '?pagina=1&tamanoPagina=10&documentoFinancieroId=2014',
        session.token,
        null,
        200,
      );
      must(
        own.registros.length > 0 && own.registros.every((r) => r.areaId === 2025),
        'Own area missing',
      );
      const foreign = await request(
        'GET',
        '/' + route + '?pagina=1&tamanoPagina=10&documentoFinancieroId=2015',
        session.token,
        null,
        200,
      );
      must(
        name === 'auditor' ? foreign.registros.length > 0 : foreign.registros.length === 0,
        'Foreign scope incorrect',
      );
      const foreignGlobal = await request(
        'GET',
        '/' + route + '?pagina=1&tamanoPagina=10&documentoFinancieroId=2015',
        auditor.token,
        null,
        200,
      );
      const id =
        foreignGlobal.registros[0][
          route === 'historial-auditoria' ? 'historialAuditoriaId' : 'bitacoraActividadId'
        ];
      await request(
        'GET',
        '/' + route + '/' + id,
        session.token,
        null,
        name === 'auditor' ? 200 : 404,
      );
      record('scope-passed', {
        name,
        route,
        own: own.totalRegistros,
        foreign: foreign.totalRegistros,
      });
    }
  }
  must(fingerprint() === baseline, 'Financial data changed');
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
        hostname: isApi ? 'localhost' : '127.0.0.1',
        port: isApi ? 7295 : 4200,
        path: incoming.url,
        method: incoming.method,
        rejectUnauthorized: isApi ? false : undefined,
        headers: { ...incoming.headers, host: isApi ? 'localhost:7295' : '127.0.0.1:4200' },
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
    relay.listen(4308, '127.0.0.1', resolve);
  });
  console.log(JSON.stringify({ run, users, areaId: 2025, browser: 'http://localhost:4308/login' }));
}
async function cleanup() {
  for (const user of users)
    await request('PUT', '/usuarios/' + user.id + '/desactivar', admin, null, 200);
  await request('PATCH', '/areas/2025/desactivar', admin, null, 200);
  must(
    Number(sql('SELECT COUNT(*) FROM AspNetUsers WHERE Id IN (3036,3037) AND Activo=1;')) === 0,
    'QA users active',
  );
  must(
    Number(sql('SELECT COUNT(*) FROM Areas WHERE AreaId=2025 AND Activo=1;')) === 0,
    'QA area active',
  );
  must(fingerprint() === baseline, 'Financial data changed');
  record('cleanup-passed', { originalInactiveStateRestored: true, financialDataUnchanged: true });
}
try {
  console.log('Credenciales por dos líneas ocultas: admin y QA.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  await setup();
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
