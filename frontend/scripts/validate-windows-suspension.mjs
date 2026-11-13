// Dedicated real-suspension fixture. The browser receives the original API response.
// Its exact JWT is held ONLY in process memory for the post-resume HTTP check.
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';

const run = `QA_SUSP_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const directory = new URL(`../docs/evidencias-suspension/${run}/`, import.meta.url);
mkdirSync(directory, { recursive: true });
const input = hiddenLines(),
  sockets = new Set(),
  startedUTC = new Date().toISOString();
let adminSecret = '',
  qaSecret = '',
  admin = null,
  token = null,
  areaId,
  userId,
  username,
  expires,
  snapshotBefore,
  server,
  apiChecked = false;
let evidence = {
  run,
  startedUTC,
  database: 'ControlFinancieroDB_Pruebas',
  phase: 'preparation',
  sameBrowserToken: true,
};
const save = () =>
  writeFileSync(new URL('evidencia.json', directory), JSON.stringify(evidence, null, 2) + '\n');
function sql(query) {
  verifyTestDatabase();
  return execFileSync(
    'sqlcmd',
    [
      '-S',
      'localhost',
      '-E',
      '-d',
      'ControlFinancieroDB_Pruebas',
      '-b',
      '-f',
      '65001',
      '-h',
      '-1',
      '-y',
      '4000',
      '-Q',
      `SET NOCOUNT ON; ${query}`,
    ],
    { encoding: 'utf8', windowsHide: true },
  ).trim();
}
function securitySnapshot() {
  return sql(
    `SELECT u.Activo,u.AreaId,u.DebeCambiarPassword,u.SecurityStamp,a.Activo AreaActiva,(SELECT r.Name FROM AspNetUserRoles ur JOIN AspNetRoles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id ORDER BY r.Name FOR JSON PATH) Roles FROM AspNetUsers u JOIN Areas a ON a.AreaId=u.AreaId WHERE u.Id=${userId} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;`,
  );
}
function windowsEvents() {
  const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); try { $events=@(Get-WinEvent -FilterHashtable @{LogName='System';ProviderName=@('Microsoft-Windows-Kernel-Power','Microsoft-Windows-Power-Troubleshooter');StartTime=[datetime]::Parse('${startedUTC}')} -MaxEvents 100 -ErrorAction Stop | ForEach-Object { $eventXml=[xml]$_.ToXml(); $data=@{}; foreach($entry in $eventXml.Event.EventData.Data){if($entry.Name -in @('SleepTime','WakeTime','TargetState','EffectiveState')){$data[$entry.Name]=[string]$entry.'#text'}}; [pscustomobject]@{recordId=$_.RecordId;id=$_.Id;provider=$_.ProviderName;timeUTC=$_.TimeCreated.ToUniversalTime().ToString('o');data=$data} }); @{available=$true;records=$events}|ConvertTo-Json -Depth 6 -Compress } catch { @{available=$false;records=@();note='No se obtuvieron eventos de energía en esta consulta'}|ConvertTo-Json -Compress }`;
  try {
    return JSON.parse(
      execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
        encoding: 'utf8',
        windowsHide: true,
      }),
    );
  } catch {
    return { available: false, records: [], note: 'Consulta de eventos no disponible' };
  }
}
async function req(method, path, auth, body) {
  verifyTestDatabase();
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    const allowed =
      (path === '/areas' && body.nombre.startsWith(run)) ||
      (path === '/usuarios' && body.nombreUsuario === username && body.areaId === areaId) ||
      (apiChecked &&
        (path === `/usuarios/${userId}/desactivar` || path === `/areas/${areaId}/desactivar`)) ||
      (!token &&
        (path === `/usuarios/${userId}/desactivar` || path === `/areas/${areaId}/desactivar`));
    if (!allowed) throw new Error('Escritura ajena o cambio durante espera bloqueado.');
  }
  const response = await fetch(`http://localhost:4200/api${path}`, {
    method,
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {}
  return { status: response.status, data };
}
async function login(name, password) {
  const result = await req('POST', '/auth/login', null, { username: name, password });
  if (result.status !== 200 || !result.data?.token)
    throw new Error('No se obtuvo sesión de preparación.');
  return result.data.token;
}
function check(ok, message) {
  if (!ok) throw new Error(message);
  console.log(`VERIFICADO: ${message}`);
}
function local(value) {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}
try {
  console.log('Dos líneas ocultas por stdin: credencial admin y credencial QA de preparación.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  admin = await login('admin', adminSecret);
  const area = await req('POST', '/areas', admin, { nombre: `${run}_A` });
  check(area.status === 201, 'Área QA dedicada creada');
  areaId = area.data.areaId;
  username = `${run.toLowerCase()}.sesion`;
  const initial = `Aa1!${randomUUID()}`;
  const user = await req('POST', '/usuarios', admin, {
    nombreUsuario: username,
    nombreCompleto: `${run} Suspensión`,
    passwordInicial: initial,
    areaId,
    roles: ['PersonalArea'],
  });
  check(user.status === 201, 'Cuenta QA dedicada creada');
  userId = user.data.usuario.id;
  const first = await login(username, initial);
  check(
    (
      await req('POST', '/auth/cambiar-password', first, {
        passwordActual: initial,
        passwordNueva: qaSecret,
      })
    ).status === 200,
    'Credencial preparada antes de iniciar la espera',
  );
  evidence = {
    ...evidence,
    userId,
    areaId,
    username,
    phase: 'awaiting-browser-login',
    powerBefore: windowsEvents(),
  };
  save();
  server = http.createServer((incoming, outgoing) => {
    (async () => {
      const path = new URL(incoming.url, 'http://localhost:4301').pathname;
      const isLogin = incoming.method === 'POST' && path === '/api/auth/login';
      if (!['GET', 'HEAD'].includes(incoming.method) && !isLogin) {
        incoming.socket.destroy();
        return;
      }
      if (isLogin && token) {
        incoming.socket.destroy();
        return;
      }
      if (path.startsWith('/api/')) verifyTestDatabase();
      const upstream = http.request(
        {
          hostname: '127.0.0.1',
          port: 4200,
          path: incoming.url,
          method: incoming.method,
          headers: { ...incoming.headers, host: 'localhost:4200' },
        },
        (response) => {
          if (!isLogin) {
            outgoing.writeHead(response.statusCode, response.headers);
            response.pipe(outgoing);
            return;
          }
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            (async () => {
              const bytes = Buffer.concat(chunks);
              if (response.statusCode === 200) {
                const actual = JSON.parse(bytes.toString());
                if (actual.usuario !== username || !actual.token)
                  throw new Error('La sesión no corresponde al actor QA.');
                const claims = JSON.parse(
                  Buffer.from(actual.token.split('.')[1], 'base64url').toString(),
                );
                expires = claims.exp * 1000;
                check(
                  Number.isFinite(expires) && expires > Date.now(),
                  'JWT nuevo con exp real futuro',
                );
                token = actual.token;
                check(
                  (await req('GET', '/registros-financieros', token)).status === 200,
                  'Mismo JWT del navegador admitido por la API antes del exp',
                );
                snapshotBefore = securitySnapshot();
                const sleepAt = Math.floor((expires - 120000) / 60000) * 60000;
                const wakeAt = Math.ceil((expires + 120000) / 60000) * 60000;
                evidence = {
                  ...evidence,
                  phase: 'ready-awaiting-real-suspension',
                  capturedUTC: new Date().toISOString(),
                  expUTC: new Date(expires).toISOString(),
                  expPeru: local(expires),
                  sleepAtUTC: new Date(sleepAt).toISOString(),
                  sleepAtPeru: local(sleepAt),
                  wakeNotBeforeUTC: new Date(wakeAt).toISOString(),
                  wakeNotBeforePeru: local(wakeAt),
                  httpBefore: 200,
                };
                save();
                console.log(
                  JSON.stringify({
                    READY: true,
                    run,
                    userId,
                    areaId,
                    username,
                    expUTC: evidence.expUTC,
                    expPeru: evidence.expPeru,
                    sleepAtPeru: evidence.sleepAtPeru,
                    wakeNotBeforePeru: evidence.wakeNotBeforePeru,
                  }),
                );
              }
              outgoing.writeHead(response.statusCode, response.headers);
              outgoing.end(bytes);
            })().catch(() => {
              evidence.phase = 'browser-preparation-error';
              save();
              outgoing.socket?.destroy();
              console.log('No se completó la preparación del navegador; no suspender todavía.');
            });
          });
        },
      );
      upstream.on('error', () => outgoing.socket?.destroy());
      incoming.pipe(upstream);
    })().catch(() => incoming.socket.destroy());
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.on('upgrade', (request, socket, head) => {
    const upstream = net.connect(4200, '127.0.0.1', () => {
      upstream.write(
        `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n${request.rawHeaders.reduce((s, v, i) => s + (i % 2 ? `${v}\r\n` : `${v}: `), '')}\r\n`,
      );
      upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      socket.destroy();
    });
    socket.on('close', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });
  await new Promise((resolve) => server.listen(4301, '127.0.0.1', resolve));
  console.log(
    JSON.stringify({ run, userId, areaId, username, browser: 'http://localhost:4301/login' }),
  );
  console.log(
    'Esperando login del navegador; después comandos ocultos: resumed, finish. No modificar cuenta/área durante la espera.',
  );
  for (;;) {
    const command = await input.read();
    if (command === 'resumed') {
      check(
        token && Date.now() > expires,
        'El exp real ya pasó; comprobación posterior a reanudación',
      );
      const result = await req('GET', '/registros-financieros', token);
      const unchanged = securitySnapshot() === snapshotBefore;
      evidence = {
        ...evidence,
        phase: 'post-resume-api-checked',
        apiCheckedUTC: new Date().toISOString(),
        httpAfter: result.status,
        securityInvariantUnchanged: unchanged,
        powerAfter: windowsEvents(),
      };
      save();
      check(
        result.status === 401,
        'API rechaza con 401 el mismo JWT naturalmente vencido del navegador',
      );
      check(unchanged, 'Cuenta, contraseña (SecurityStamp), roles y área sin cambios');
      apiChecked = true;
      console.log(
        JSON.stringify({
          phase: evidence.phase,
          httpAfter: result.status,
          expUTC: evidence.expUTC,
          checkedUTC: evidence.apiCheckedUTC,
          powerAfter: evidence.powerAfter,
        }),
      );
    }
    if (command === 'finish') {
      check(apiChecked, 'API posterior comprobada antes de limpiar');
      check(
        securitySnapshot() === snapshotBefore,
        'Invariante conservado hasta terminar navegador',
      );
      break;
    }
  }
} catch (error) {
  console.log(`PREPARACIÓN/VALIDACIÓN INTERRUMPIDA: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.destroy();
  server?.closeAllConnections();
  server?.close();
  if (areaId && (!token || apiChecked)) {
    try {
      admin = await login('admin', adminSecret);
      if (userId)
        check(
          (await req('PUT', `/usuarios/${userId}/desactivar`, admin, {})).status === 200,
          `Limpieza cuenta QA ${userId}`,
        );
      check(
        (await req('PATCH', `/areas/${areaId}/desactivar`, admin, {})).status === 200,
        `Limpieza área QA ${areaId}`,
      );
      evidence.cleanup = 'deactivated-own-fixtures';
      save();
    } catch {
      console.log('Limpieza pendiente; no modificar otros fixtures.');
      process.exitCode = 1;
    }
  } else if (areaId)
    console.log('Cuenta/área QA conservadas activas: prueba y limpieza pendientes.');
  adminSecret = '';
  qaSecret = '';
  admin = null;
  token = null;
  input.close();
}
