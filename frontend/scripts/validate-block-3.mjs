// Local integration fixture: real TCP response loss, not an HTTP mock.
// No credentials/JWT/request headers are written to evidence or console.
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
const directory = new URL('../docs/evidencias-bloque-3/', import.meta.url);
mkdirSync(directory, { recursive: true });
const input = hiddenLines();
let run = `QA_B3_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const sockets = new Set();
let adminSecret,
  qaSecret,
  admin,
  actor,
  areaId,
  userId,
  server,
  mode = 'online',
  attempts = 0,
  forwarded = 0,
  reconciled = false;
const events = [];
function event(kind, extra = {}) {
  const value = { kind, utc: new Date().toISOString(), ...extra };
  events.push(value);
  writeFileSync(new URL('transporte.json', directory), JSON.stringify(events, null, 2));
  console.log(JSON.stringify(value));
}
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
    ).trim() || '[]',
  );
}
async function req(method, path, token, body) {
  verifyTestDatabase();
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    const allowed =
      (path === '/areas' && body.nombre.startsWith(run)) ||
      (path === '/usuarios' &&
        body.nombreUsuario.startsWith(run.toLowerCase()) &&
        body.areaId === areaId) ||
      path === `/usuarios/${userId}/desactivar` ||
      path === `/areas/${areaId}/desactivar` ||
      path === `/usuarios/${userId}/activar` ||
      path === `/areas/${areaId}/activar`;
    if (!allowed) throw new Error('Escritura de preparación ajena bloqueada.');
  }
  const response = await fetch(`http://localhost:4200/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.headers.get('content-type')?.includes('spreadsheetml'))
    return { status: response.status, bytes: Buffer.from(await response.arrayBuffer()) };
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  return { status: response.status, data };
}
async function login(username, password) {
  const r = await req('POST', '/auth/login', null, { username, password });
  if (r.status !== 200 || !r.data?.token) throw new Error('No se pudo preparar sesión QA.');
  return r.data.token;
}
const assert = (ok, message) => {
  if (!ok) throw new Error(message);
  console.log(`APROBADO: ${message}`);
};
let before;
async function snapshot(name) {
  const result = await req('GET', '/alertas/142', actor);
  if (result.status !== 200) throw new Error('No se obtuvo alerta QA de referencia.');
  const activities = sql(
    "SELECT BitacoraActividadId,UsuarioId,TipoActividad,Resultado,CONVERT(varchar(40),FechaHora,126) fechaUTC,Detalle FROM BitacorasActividades WHERE TipoActividad='CierreAlerta' AND Detalle LIKE 'AlertaId=142;%' ORDER BY BitacoraActividadId",
  );
  const evidence = {
    run,
    database: 'ControlFinancieroDB_Pruebas',
    utc: new Date().toISOString(),
    actorId: userId,
    alerta: result.data,
    activities,
    attempts,
    forwarded,
  };
  writeFileSync(new URL(`${name}.json`, directory), JSON.stringify(evidence, null, 2));
  console.log(
    JSON.stringify({
      snapshot: name,
      estado: result.data.estado,
      rowVersion: result.data.rowVersion,
      cierres: activities.length,
      attempts,
      forwarded,
    }),
  );
  return evidence;
}
try {
  console.log('Dos líneas ocultas por stdin: credencial admin y credencial QA de preparación.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  admin = await login('admin', adminSecret);
  let username;
  if (process.argv.includes('--resume-own')) {
    const fixture = sql(
      'SELECT u.Id,u.UserName,u.AreaId,a.Nombre FROM AspNetUsers u JOIN Areas a ON a.AreaId=u.AreaId WHERE u.Id=1030 AND a.AreaId=25',
    )[0];
    if (
      !fixture ||
      !/^QA_B3_\d{14}_A$/.test(fixture.Nombre) ||
      fixture.UserName !== fixture.Nombre.slice(0, -2).toLowerCase() + '.auditor'
    )
      throw new Error('Fixture de reanudación no pertenece al bloque actual.');
    run = fixture.Nombre.slice(0, -2);
    areaId = fixture.AreaId;
    userId = fixture.Id;
    username = fixture.UserName;
    assert(
      (await req('PATCH', `/areas/${areaId}/activar`, admin, {})).status === 200,
      'Reutilizar únicamente área propia de preparación interrumpida',
    );
    assert(
      (await req('PUT', `/usuarios/${userId}/activar`, admin, {})).status === 200,
      'Reutilizar únicamente Auditor propio de preparación interrumpida',
    );
  } else {
    const area = await req('POST', '/areas', admin, { nombre: `${run}_A` });
    assert(area.status === 201, 'Preparar área QA propia');
    areaId = area.data.areaId;
    const initial = `Aa1!${randomUUID()}`;
    username = `${run.toLowerCase()}.auditor`;
    const user = await req('POST', '/usuarios', admin, {
      nombreUsuario: username,
      nombreCompleto: `${run} Auditor`,
      passwordInicial: initial,
      areaId,
      roles: ['Auditor'],
    });
    assert(user.status === 201, 'Preparar Auditor QA propio');
    userId = user.data.usuario.id;
    const first = await login(username, initial);
    assert(
      (
        await req('POST', '/auth/cambiar-password', first, {
          passwordActual: initial,
          passwordNueva: qaSecret,
        })
      ).status === 200,
      'Completar preparación de credencial por API',
    );
  }
  actor = await login(username, qaSecret);
  const owner = sql(
    'SELECT u.UserName,a.Estado FROM Alertas a JOIN AspNetUsers u ON u.Id=a.UsuarioId WHERE a.AlertaId=142',
  )[0];
  assert(
    owner?.UserName === 'qa_m9_20261111232036.auditor' && owner.Estado === 'En revision',
    'Alerta QA 142 reservada para O9, ya preparada',
  );
  before = await snapshot('o9-antes');
  assert(before.activities.length === 0, 'Sin cierre previo de la alerta QA');
  server = http.createServer((incoming, outgoing) => {
    (async () => {
      const path = new URL(incoming.url, 'http://localhost:4300').pathname;
      if (mode === 'offline' && path.startsWith('/api/')) {
        event('tcp-destroy-offline', { method: incoming.method, path });
        incoming.socket.destroy();
        return;
      }
      const close = incoming.method === 'POST' && path === '/api/alertas/142/cerrar';
      if (
        incoming.method !== 'GET' &&
        incoming.method !== 'HEAD' &&
        path !== '/api/auth/login' &&
        !close
      ) {
        incoming.socket.destroy();
        return;
      }
      if (close) {
        attempts++;
        event('close-request-received', { attempts });
        if (mode !== 'armed' || attempts !== 1) {
          event('unexpected-write-blocked');
          incoming.socket.destroy();
          return;
        }
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const payload = Buffer.concat(chunks),
          data = JSON.parse(payload.toString());
        if (
          !data.justificacion?.startsWith(run) ||
          data.estado !== 'Resuelta' ||
          data.rowVersion !== before.alerta.rowVersion
        )
          throw new Error('Cierre no corresponde al caso QA reservado.');
        verifyTestDatabase();
        const proxy = http.request(
          {
            hostname: '127.0.0.1',
            port: 4200,
            path: incoming.url,
            method: incoming.method,
            headers: { ...incoming.headers, host: 'localhost:4200' },
          },
          (response) => {
            // Real server response arrived. Do not relay even its headers to Angular.
            mode = 'offline';
            event('tcp-destroy-response', { upstreamStatus: response.statusCode, forwarded });
            outgoing.socket?.destroy();
            response.resume();
          },
        );
        proxy.on('error', () => {
          mode = 'offline';
          event('upstream-transport-error');
          outgoing.socket?.destroy();
        });
        forwarded++;
        event('write-forwarded-to-real-api', { forwarded });
        proxy.end(payload);
        return;
      }
      if (path.startsWith('/api/')) verifyTestDatabase();
      const proxy = http.request(
        {
          hostname: '127.0.0.1',
          port: 4200,
          path: incoming.url,
          method: incoming.method,
          headers: { ...incoming.headers, host: 'localhost:4200' },
        },
        (response) => {
          outgoing.writeHead(response.statusCode, response.headers);
          response.pipe(outgoing);
        },
      );
      proxy.on('error', () => outgoing.socket?.destroy());
      incoming.pipe(proxy);
    })().catch(() => {
      event('relay-stopped-request');
      incoming.socket.destroy();
    });
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
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(4300, '127.0.0.1', resolve));
  console.log(
    JSON.stringify({
      run,
      areaId,
      userId,
      username,
      relay: 'http://localhost:4300',
      alertaId: 142,
    }),
  );
  console.log('Comandos ocultos: arm, recover, exports, finish.');
  for (;;) {
    const command = await input.read();
    if (command === 'arm') {
      verifyTestDatabase();
      mode = 'armed';
      event('armed-for-one-QA-close');
    }
    if (command === 'recover') {
      assert(mode === 'offline', 'Hubo desconexión TCP real');
      mode = 'online';
      event('connection-recovered');
      const after = await snapshot('o9-despues-recuperacion');
      assert(
        after.alerta.estado === 'Resuelta' &&
          after.alerta.rowVersion !== before.alerta.rowVersion &&
          after.activities.length === 1 &&
          after.activities[0].UsuarioId === userId &&
          attempts === 1 &&
          forwarded === 1,
        'O9 reconciliación real: cierre guardado una sola vez, versión nueva y bitácora única; sin reenvío',
      );
      reconciled = true;
    }
    if (command === 'exports') {
      const filters = new URLSearchParams({
        fechaDesde: '2026-11-12',
        fechaHasta: '2026-11-12',
        areaId: '24',
        documentoFinancieroId: '12',
      });
      const summary = await req('GET', `/reportes-financieros/resumen?${filters}`, actor),
        detail = await req(
          'GET',
          `/reportes-financieros/detalle?${filters}&tamanoPagina=100&pagina=1`,
          actor,
        );
      assert(
        summary.status === 200 && detail.status === 200,
        'O10 referencias JSON reales de resumen/detalle',
      );
      writeFileSync(
        new URL('o10-referencia-api.json', directory),
        JSON.stringify(
          { run, utc: new Date().toISOString(), summary: summary.data, detail: detail.data },
          null,
          2,
        ),
      );
      for (const [name, path] of [
        ['documento', '/documentos-financieros/12/exportar'],
        ['resumen', `/reportes-financieros/resumen/exportar?${filters}`],
        ['detalle', `/reportes-financieros/detalle/exportar?${filters}`],
      ]) {
        const file = await req('GET', path, actor);
        assert(file.status === 200 && file.bytes?.length > 0, `Exportación real ${name} HTTP 200`);
        writeFileSync(new URL(`o10-${name}.xlsx`, directory), file.bytes);
        console.log(JSON.stringify({ archivo: `o10-${name}.xlsx`, bytes: file.bytes.length }));
      }
    }
    if (command === 'abort') {
      assert(
        attempts === 0 && forwarded === 0,
        'Preparación interrumpida antes de cualquier cierre O9',
      );
      event('validation-not-executed');
      break;
    }
    if (command === 'finish') {
      assert(
        reconciled && attempts === 1 && forwarded === 1,
        'O9 sin escrituras repetidas hasta terminar',
      );
      break;
    }
  }
} catch (error) {
  console.log(`VALIDACIÓN INTERRUMPIDA: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const socket of sockets) socket.destroy();
  server?.closeAllConnections();
  server?.close();
  try {
    if (areaId) {
      admin = await login('admin', adminSecret);
      if (userId)
        assert(
          (await req('PUT', `/usuarios/${userId}/desactivar`, admin, {})).status === 200,
          `Limpieza usuario QA ${userId}`,
        );
      assert(
        (await req('PATCH', `/areas/${areaId}/desactivar`, admin, {})).status === 200,
        `Limpieza área QA ${areaId}`,
      );
    }
  } catch (error) {
    console.log(`LIMPIEZA PENDIENTE: ${error.message}`);
    process.exitCode = 1;
  }
  adminSecret = '';
  qaSecret = '';
  admin = null;
  actor = null;
  input.close();
}
