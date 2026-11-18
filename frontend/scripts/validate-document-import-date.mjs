// Isolated API process, existing test DB only. No credentials/JWT written or printed.
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

import { hiddenLines } from './testing/test-environment.mjs';
const run = `QA_DOC_TIME_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const directory = new URL(
  `../docs/evidencias-correccion-fecha-documentos/${run}/`,
  import.meta.url,
);
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
  apiPort: 7298,
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
    const encoded = new Request('https://localhost:7298/api' + path, { method, body });
    bytes = Buffer.from(await encoded.arrayBuffer());
    type = encoded.headers.get('content-type');
  } else if (body) bytes = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: 7298,
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
  if (method !== 'GET' && !path.startsWith('/auth/'))
    must(
      (method === 'PATCH' && /^\/areas\/2025\/(activar|desactivar)$/.test(path)) ||
        (method === 'PUT' && /^\/usuarios\/3037\/(activar|desactivar)$/.test(path)),
      'Only QA state preparation allowed',
    );
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

let financeBefore, documentBefore;
function financeHash() {
  return sql(
    "SELECT CONVERT(varchar(64),HASHBYTES('SHA2_256',STRING_AGG(CONVERT(nvarchar(max),CONCAT(RegistroFinancieroId,';',TipoOperacion,';',Descripcion,';',FechaOperacion,';',Monto,';',AreaId,';',UsuarioId,';',DocumentoFinancieroId,';',CONVERT(varchar(32),RowVersion,2))),N'|') WITHIN GROUP(ORDER BY RegistroFinancieroId)),2) FROM RegistrosFinancieros;",
  );
}
function documentSnapshot() {
  return sql('SELECT * FROM DocumentosFinancieros WHERE DocumentoFinancieroId=2014 FOR JSON PATH;');
}
async function setup() {
  must(
    Number(
      sql(
        "SELECT COUNT(*) FROM Areas WHERE AreaId=2025 AND Nombre='QA_EXP_B2_20261115045253_A' AND Activo=0;",
      ),
    ) === 1,
    'QA area mismatch',
  );
  must(
    Number(
      sql(
        "SELECT COUNT(*) FROM AspNetUsers WHERE Id=3037 AND UserName='qa_exp_b2_20261115045253.auditor' AND AreaId=2025 AND Activo=0;",
      ),
    ) === 1,
    'QA auditor mismatch',
  );
  users.push({ id: 3037, username: 'qa_exp_b2_20261115045253.auditor' });
  areas.push(2025);
  financeBefore = financeHash();
  documentBefore = documentSnapshot();
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(7298, '127.0.0.1', () => server.close(resolve));
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
    ASPNETCORE_URLS: 'https://localhost:7298',
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
      const socket = net.connect(7298, '127.0.0.1');
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
  await request('PUT', '/usuarios/3037/activar', admin, null, 200);
  const auditor = await login(users[0].username, qaSecret);
  const document = await request('GET', '/documentos-financieros/2014', auditor, null, 200),
    catalog = await request('GET', '/documentos-financieros', auditor, null, 200);
  const stored = JSON.parse(
    sql(
      "SELECT CONVERT(varchar(33),FechaImportacion,126) AS sqlUtc,CONVERT(varchar(33),CAST(FechaImportacion AT TIME ZONE 'UTC' AT TIME ZONE 'SA Pacific Standard Time' AS datetime2),126) AS sqlPeru FROM DocumentosFinancieros WHERE DocumentoFinancieroId=2014 FOR JSON PATH;",
    ),
  )[0];
  must(
    document.fechaImportacion === stored.sqlUtc &&
      catalog.find((d) => d.documentoFinancieroId === 2014).fechaImportacion === stored.sqlUtc,
    'SQL/API date mismatch',
  );
  must(stored.sqlPeru === '2026-11-14T23:53:32.7419396', 'Unexpected QA import time');
  record('document-date-api-sql-passed', {
    documentId: 2014,
    ...stored,
    apiUtc: document.fechaImportacion,
    expectedDisplay: '14/11/2026 23:53',
    rows: document.totalRegistros,
  });
  relay = http.createServer((incoming, outgoing) => {
    const isApi = incoming.url.startsWith('/api/');
    if (isApi) {
      try {
        verify();
        must(
          incoming.method === 'GET' || incoming.url === '/api/auth/login',
          'Only browser consultation allowed',
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
        port: isApi ? 7298 : 4200,
        path: incoming.url,
        method: incoming.method,
        rejectUnauthorized: isApi ? false : undefined,
        headers: { ...incoming.headers, host: isApi ? 'localhost:7298' : '127.0.0.1:4200' },
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
    relay.listen(4311, '127.0.0.1', resolve);
  });
  console.log(
    JSON.stringify({
      run,
      browser: 'http://localhost:4311/login',
      username: users[0].username,
      expected: '14/11/2026 23:53',
    }),
  );
}
async function cleanup() {
  admin = await login('admin', adminSecret);
  await request('PUT', '/usuarios/3037/desactivar', admin, null, 200);
  await request('PATCH', '/areas/2025/desactivar', admin, null, 200);
  must(
    Number(sql('SELECT COUNT(*) FROM AspNetUsers WHERE Id=3037 AND Activo=1;')) === 0 &&
      Number(sql('SELECT COUNT(*) FROM Areas WHERE AreaId=2025 AND Activo=1;')) === 0,
    'QA state not restored',
  );
  must(
    financeHash() === financeBefore && documentSnapshot() === documentBefore,
    'Financial data changed',
  );
  record('cleanup-passed', {
    qaInactive: true,
    documentUnchanged: true,
    financialDataUnchanged: true,
  });
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
  record('isolated-process-stopped', { pid: api?.pid, failed });
}
