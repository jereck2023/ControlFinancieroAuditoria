import { randomUUID } from 'node:crypto';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
import { execFileSync } from 'node:child_process';

const base = 'http://localhost:4200/api';
const run = `QA_M9_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const owned = { areas: [], users: [], records: [], documents: [], alerts: [] };
const checks = [];
const input = hiddenLines();
let admin;
let testPassword;
console.log(
  'Ingrese dos líneas ocultas por stdin: credencial admin y credencial temporal QA. No se guardarán.',
);
async function req(method, path, token, body, upload) {
  verifyTestDatabase();
  const alertWrite = method !== 'GET' && path.match(/^\/alertas\/(\d+)\//);
  if (alertWrite && !owned.alerts.includes(Number(alertWrite[1])))
    throw new Error('Alerta ajena bloqueada.');
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    if (path.startsWith('/historial-auditoria') || path.startsWith('/bitacora-actividades'))
      throw new Error('La trazabilidad es de solo lectura.');
    const match = path.match(/^\/(areas|usuarios|registros-financieros)\/(\d+)/);
    const group =
      match && { areas: 'areas', usuarios: 'users', 'registros-financieros': 'records' }[match[1]];
    if (match && !owned[group].includes(Number(match[2]))) throw new Error('ID ajeno bloqueado.');
    const payload = typeof body === 'string' ? JSON.parse(body) : body;
    if (path === '/areas' && !payload.nombre.startsWith(run))
      throw new Error('Prefijo de área inválido.');
    if (path === '/usuarios' && !payload.nombreUsuario.startsWith(run.toLowerCase()))
      throw new Error('Prefijo de cuenta inválido.');
    if (path === '/registros-financieros' && !payload.descripcion.startsWith(run))
      throw new Error('Prefijo de registro inválido.');
  }
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !upload ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(upload
      ? { body: upload }
      : body
        ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
        : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (response.headers.get('content-type')?.includes('spreadsheetml'))
    return {
      status: response.status,
      bytes: Buffer.from(await response.arrayBuffer()),
      disposition: response.headers.get('content-disposition'),
    };
  let data = null;
  try {
    data = JSON.parse(await response.text(), (key, value, context) =>
      /^(monto|totalIngresos|totalEgresos|diferencia)$/i.test(key) && typeof value === 'number'
        ? context.source
        : value,
    );
  } catch {
    /* Empty or non-JSON errors remain opaque. */
  }
  return { status: response.status, data };
}
function check(name, response, expected, condition = true) {
  const passed = response.status === expected && condition;
  checks.push({ prueba: name, esperado: expected, obtenido: response.status, aprobada: passed });
  console.log(JSON.stringify(checks.at(-1)));
  if (!passed) throw new Error(`Falló ${name}; HTTP ${response.status}`);
  return response.data;
}
function query(path, params) {
  return (
    path +
    '?' +
    new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ).toString()
  );
}
async function login(username, password) {
  const result = await req('POST', '/auth/login', null, { username, password });
  if (result.status !== 200 || !result.data?.token)
    throw new Error('No se pudo preparar la sesión QA.');
  return result.data.token;
}
async function user(area, suffix) {
  const username = `${run.toLowerCase()}.${suffix}`;
  const initial = 'Aa1!' + randomUUID();
  const created = check(
    `Preparar cuenta ${suffix}`,
    await req('POST', '/usuarios', admin, {
      nombreUsuario: username,
      nombreCompleto: `${run} ${suffix}`,
      passwordInicial: initial,
      areaId: area,
      roles: ['PersonalArea'],
    }),
    201,
  );
  owned.users.push(created.usuario.id);
  const first = await login(username, initial);
  const changed = await req('POST', '/auth/cambiar-password', first, {
    passwordActual: initial,
    passwordNueva: testPassword,
  });
  if (changed.status !== 200) throw new Error('No se pudo preparar la contraseña QA.');
  return { id: created.usuario.id, username, token: await login(username, testPassword) };
}
async function record(token, name, amount = '10.25', operation = 'Ingreso') {
  const body = `{"tipoOperacion":"${operation}","descripcion":"${run} ${name}","fechaOperacion":"2026-11-11","monto":${amount}}`;
  const result = check(
    `Preparar registro ${name}`,
    await req('POST', '/registros-financieros', token, body),
    201,
  );
  owned.records.push(result.registroId);
  return (await req('GET', `/registros-financieros/${result.registroId}`, token)).data;
}
async function roles(account, assigned) {
  const result = await req('PUT', `/usuarios/${account.id}/roles`, admin, { roles: assigned });
  if (result.status !== 200) throw new Error('No se pudo preparar combinación de roles.');
  account.token = await login(account.username, testPassword);
}
async function cleanup() {
  if (!admin) return;
  for (const id of owned.users) {
    const result = await req('GET', `/usuarios/${id}`, admin);
    if (!result.data?.userName.startsWith(run.toLowerCase()))
      throw new Error('Cuenta ajena en limpieza.');
    if (result.data.activo)
      check(`Limpiar cuenta ${id}`, await req('PUT', `/usuarios/${id}/desactivar`, admin, {}), 200);
  }
  const areas = (await req('GET', '/areas', admin)).data;
  for (const id of owned.areas) {
    const area = areas.find((item) => item.areaId === id);
    if (!area?.nombre.startsWith(run)) throw new Error('Área ajena en limpieza.');
    if (area.activo)
      check(`Limpiar área ${id}`, await req('PATCH', `/areas/${id}/desactivar`, admin, {}), 200);
  }
}

function sqlJson(queryText) {
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
        '-l',
        '5',
        '-y',
        '0',
        '-w',
        '65535',
        '-Q',
        `SET NOCOUNT ON; ${queryText} FOR JSON PATH;`,
      ],
      { encoding: 'utf8', windowsHide: true },
    ).trim() || '[]',
  );
}
function assertion(name, passed) {
  checks.push({ prueba: name, aprobada: passed });
  console.log(JSON.stringify(checks.at(-1)));
  if (!passed) throw new Error(`Falló ${name}`);
}

async function financialAlertSource(account, suffix, threshold) {
  const original = await record(account.token, suffix);
  let version = original.rowVersion;
  for (let i = 1; i <= threshold; i++) {
    const updated = check(
      `Preparar ${suffix} cambio ${i}`,
      await req('PUT', `/registros-financieros/${original.registroFinancieroId}`, account.token, {
        tipoOperacion: 'Ingreso',
        descripcion: `${run} ${suffix} CAMBIO_${i}`,
        fechaOperacion: '2026-11-11',
        monto: 10.25,
        rowVersion: version,
      }),
      200,
    );
    version = updated.rowVersion;
  }
  return original.registroFinancieroId;
}
async function getAlert(id, token, expected = 200, label = 'Consultar detalle QA') {
  const response = await req('GET', `/alertas/${id}`, token);
  check(label, response, expected);
  return response.data;
}
async function start(id, token, version, expected = 200, label = 'Iniciar revisión QA') {
  const response = await req('POST', `/alertas/${id}/iniciar-revision`, token, {
    rowVersion: version,
  });
  check(label, response, expected);
  return response.data;
}
async function close(
  id,
  token,
  version,
  state = 'Resuelta',
  expected = 200,
  justification = `${run} Cierre documentado <b>solo texto</b>.`,
  label = 'Cerrar alerta QA',
) {
  const response = await req('POST', `/alertas/${id}/cerrar`, token, {
    rowVersion: version,
    estado: state,
    justificacion: justification,
  });
  check(label, response, expected);
  return response.data;
}
async function listAlerts(
  token,
  filters = {},
  expected = 200,
  label = 'Consultar listado QA',
  condition = () => true,
) {
  const response = await req(
    'GET',
    query('/alertas', { pagina: 1, tamanoPagina: 20, ...filters }),
    token,
  );
  check(label, response, expected, condition(response.data));
  return response.data;
}
try {
  let password = await input.read();
  testPassword = await input.read();
  if (!password || !testPassword) throw new Error('Faltan credenciales.');
  const rules = sqlJson('SELECT Codigo,Activa,Umbral,VentanaMinutos FROM ReglasAnomalia');
  const repeat = rules.find((r) => r.Codigo === 'MODIFICACION_REITERADA'),
    loginRule = rules.find((r) => r.Codigo === 'LOGIN_FALLIDO_REITERADO');
  assertion(
    'Reglas activas para fixtures pequeños',
    repeat?.Activa &&
      loginRule?.Activa &&
      repeat.Umbral > 0 &&
      repeat.Umbral <= 5 &&
      loginRule.Umbral > 0 &&
      loginRule.Umbral <= 5,
  );
  admin = await login('admin', password);
  password = '';
  const a = check(
    'Preparar área A',
    await req('POST', '/areas', admin, { nombre: `${run}_A` }),
    201,
  );
  owned.areas.push(a.areaId);
  const b = check(
    'Preparar área B',
    await req('POST', '/areas', admin, { nombre: `${run}_B` }),
    201,
  );
  owned.areas.push(b.areaId);
  const actor = await user(a.areaId, 'auditor'),
    chief = await user(a.areaId, 'jefe'),
    foreign = await user(b.areaId, 'otraarea');
  await roles(actor, ['Auditor']);
  const r1 = await financialAlertSource(chief, 'RESOLVER', repeat.Umbral),
    r2 = await financialAlertSource(chief, 'DESCARTAR', repeat.Umbral),
    r3 = await financialAlertSource(chief, 'NAVEGADOR', repeat.Umbral),
    r4 = await financialAlertSource(foreign, 'OTRA_AREA', repeat.Umbral);
  const wrong = randomUUID();
  for (let i = 1; i <= loginRule.Umbral; i++)
    check(
      `Preparar fallo QA ${i}`,
      await req('POST', '/auth/login', null, { username: foreign.username, password: wrong }),
      401,
    );
  check(
    'Generar alertas QA mediante detección',
    await req('POST', '/anomalias/detectar', actor.token),
    200,
  );
  const fixtures = sqlJson(
    `SELECT a.AlertaId,a.UsuarioId,a.RegistroFinancieroId,r.Codigo FROM Alertas a JOIN ReglasAnomalia r ON r.ReglaAnomaliaId=a.ReglaAnomaliaId WHERE a.UsuarioId IN (${owned.users.join(',')}) ORDER BY a.AlertaId`,
  );
  owned.alerts.push(...fixtures.map((f) => f.AlertaId));
  const findRecord = (id) =>
    fixtures.find((f) => f.RegistroFinancieroId === id && f.Codigo === 'MODIFICACION_REITERADA')
      ?.AlertaId;
  const h1 = findRecord(r1),
    h2 = findRecord(r2),
    ui = findRecord(r3),
    other = findRecord(r4),
    security = fixtures.find(
      (f) => f.UsuarioId === foreign.id && f.Codigo === 'LOGIN_FALLIDO_REITERADO',
    )?.AlertaId;
  assertion(
    'Cinco alertas objetivo propias disponibles',
    [h1, h2, ui, other, security].every(Number.isSafeInteger),
  );
  await roles(chief, ['JefeArea']);
  const ownList = await listAlerts(
    chief.token,
    {},
    200,
    'JefeArea ve solo alertas financieras propias',
    (data) =>
      data.alertas.length > 0 &&
      data.alertas.every(
        (row) =>
          row.areaId === a.areaId &&
          row.registroFinancieroId !== null &&
          row.codigoRegla !== 'LOGIN_FALLIDO_REITERADO',
      ),
  );
  const d0 = await getAlert(h1, chief.token);
  assertion(
    'Detalle incluye evidencia, versión y metadata',
    !!d0.evidenciasJson && typeof d0.rowVersion === 'string' && d0.estado === 'Pendiente',
  );
  await start(h1, chief.token, 'bad', 400, 'Rechaza versión inválida');
  await close(
    h1,
    chief.token,
    d0.rowVersion,
    'Resuelta',
    409,
    `${run} Cierre previo inválido`,
    'No cierra Pendiente',
  );
  const begun = await start(h1, chief.token, d0.rowVersion);
  assertion(
    'Iniciar revisión registra usuario, fecha y nueva versión',
    begun.estado === 'En revision' &&
      begun.usuarioRevisionId === chief.id &&
      !!begun.fechaInicioRevisionUtc &&
      begun.rowVersion !== d0.rowVersion,
  );
  await start(h1, chief.token, d0.rowVersion, 409, 'No reinicia En revision');
  await close(h1, chief.token, begun.rowVersion, 'Pendiente', 400);
  await close(h1, chief.token, begun.rowVersion, 'Resuelta', 400, '   ');
  await close(h1, chief.token, begun.rowVersion, 'Resuelta', 400, '123456789');
  await close(h1, chief.token, begun.rowVersion, 'Resuelta', 400, 'a'.repeat(1001));
  await close(
    h1,
    chief.token,
    d0.rowVersion,
    'Resuelta',
    409,
    `${run} Cierre con versión antigua`,
    'Concurrencia: cierre con RowVersion anterior',
  );
  const fresh = await getAlert(h1, chief.token);
  assertion(
    'Conflictos no alteraron el estado en revisión',
    fresh.estado === 'En revision' && fresh.rowVersion === begun.rowVersion,
  );
  const resolved = await close(h1, chief.token, fresh.rowVersion);
  assertion(
    'Cierre conserva trazabilidad',
    resolved.estado === 'Resuelta' &&
      resolved.usuarioCierreId === chief.id &&
      !!resolved.fechaCierreUtc &&
      resolved.justificacionCierre.includes(run),
  );
  await close(
    h1,
    chief.token,
    resolved.rowVersion,
    'Descartada',
    409,
    `${run} No permite recerrar`,
  );
  const second = await getAlert(h2, actor.token),
    secondStart = await start(h2, actor.token, second.rowVersion);
  await close(h2, actor.token, secondStart.rowVersion, 'Descartada');
  const outside = await getAlert(other, actor.token),
    outsideStart = await start(other, actor.token, outside.rowVersion);
  await close(other, actor.token, outsideStart.rowVersion);
  const loginAlert = await getAlert(security, actor.token),
    loginStart = await start(security, actor.token, loginAlert.rowVersion);
  await close(security, actor.token, loginStart.rowVersion, 'Descartada');
  await getAlert(security, chief.token, 404, 'JefeArea no ve LOGIN_FALLIDO_REITERADO');
  await getAlert(other, chief.token, 404, 'JefeArea no ve otra área');
  const closedOwn = await getAlert(h2, actor.token),
    closedSecurity = await getAlert(security, actor.token);
  const names = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'];
  for (let mask = 1; mask < 16; mask++) {
    const assigned = names.filter((_, bit) => mask & (1 << bit));
    await roles(actor, assigned);
    const allowed = assigned.includes('Auditor') || assigned.includes('JefeArea'),
      global = assigned.includes('Auditor'),
      label = assigned.join('+');
    await listAlerts(actor.token, { usuarioId: chief.id }, allowed ? 200 : 403, `Listado ${label}`);
    await getAlert(h2, actor.token, allowed ? 200 : 403, `Detalle financiero ${label}`);
    await getAlert(
      security,
      actor.token,
      global ? 200 : allowed ? 404 : 403,
      `Detalle de seguridad ${label}`,
    );
    await start(
      h2,
      actor.token,
      closedOwn.rowVersion,
      allowed ? 409 : 403,
      `Acceso a revisión financiera ${label}`,
    );
    await close(
      security,
      actor.token,
      closedSecurity.rowVersion,
      'Descartada',
      global ? 409 : allowed ? 404 : 403,
      `${run} Prueba de autorización sin recierre`,
      `Acceso a cierre de seguridad ${label}`,
    );
    if (allowed)
      await listAlerts(
        actor.token,
        { areaId: b.areaId },
        200,
        `Filtro no amplía alcance ${label}`,
        (data) => (global ? data.totalRegistros > 0 : data.totalRegistros === 0),
      );
  }
  await roles(actor, ['Auditor']);
  const firstPage = await listAlerts(
    actor.token,
    { usuarioId: chief.id, tamanoPagina: 1 },
    200,
    'Página 1 del servidor',
  );
  const secondPage = await listAlerts(
    actor.token,
    { usuarioId: chief.id, tamanoPagina: 1, pagina: 2 },
    200,
    'Página 2 del servidor',
  );
  assertion(
    'Páginas y totales coherentes',
    firstPage.totalRegistros === secondPage.totalRegistros &&
      firstPage.alertas[0].alertaId !== secondPage.alertas[0].alertaId,
  );
  await listAlerts(
    actor.token,
    { estado: 'Resuelta', usuarioId: chief.id },
    200,
    'Filtro de estado',
    (data) =>
      data.alertas.some((row) => row.alertaId === h1) &&
      data.alertas.every((row) => row.estado === 'Resuelta'),
  );
  await listAlerts(
    actor.token,
    { reglaAnomaliaId: closedOwn.reglaAnomaliaId, usuarioId: chief.id },
    200,
    'Filtro de regla',
    (data) => data.alertas.every((row) => row.codigoRegla === 'MODIFICACION_REITERADA'),
  );
  const stamp = closedOwn.fechaHoraEvento.endsWith('Z')
    ? closedOwn.fechaHoraEvento
    : closedOwn.fechaHoraEvento + 'Z';
  await listAlerts(
    actor.token,
    { fechaDesde: stamp, fechaHasta: stamp, usuarioId: chief.id },
    200,
    'Filtro exacto por fecha de evento',
    (data) => data.alertas.some((row) => row.alertaId === h2),
  );
  await listAlerts(
    actor.token,
    { usuarioId: 2147483647 },
    200,
    'Listado vacío',
    (data) => data.totalRegistros === 0 && data.alertas.length === 0,
  );
  for (const filters of [
    { estado: 'En revisión' },
    { pagina: 0 },
    { tamanoPagina: 101 },
    { reglaAnomaliaId: 0 },
    { areaId: -1 },
    { usuarioId: -1 },
    { fechaDesde: '2026-11-12', fechaHasta: '2026-11-11' },
  ])
    await listAlerts(actor.token, filters, 400, 'Filtros inválidos rechazados');
  await listAlerts(null, {}, 401, 'Listado sin sesión');
  await getAlert(0, actor.token, 400, 'ID inválido');
  await getAlert(2147483647, actor.token, 404, 'ID inexistente');
  await req('PATCH', `/areas/${a.areaId}/desactivar`, admin, {});
  await listAlerts(chief.token, {}, 403, 'JefeArea inactiva no consulta');
  await getAlert(h1, chief.token, 403, 'JefeArea inactiva no obtiene detalle');
  await start(h1, chief.token, resolved.rowVersion, 404, 'JefeArea inactiva no muta');
  await listAlerts(actor.token, { areaId: a.areaId }, 200, 'Auditor conserva alcance global');
  await req('PATCH', `/areas/${a.areaId}/activar`, admin, {});
  const trace = sqlJson(
    `SELECT TipoActividad,Detalle FROM BitacorasActividades WHERE TipoActividad IN ('InicioRevisionAlerta','CierreAlerta') AND UsuarioId IN (${owned.users.join(',')})`,
  );
  assertion(
    'Operaciones guardaron trazabilidad de revisión y cierre',
    trace.filter((row) => row.TipoActividad === 'InicioRevisionAlerta').length >= 4 &&
      trace.filter((row) => row.TipoActividad === 'CierreAlerta').length >= 4 &&
      trace.some((row) => row.Detalle.includes(run)),
  );
  if (process.argv.includes('--ui')) {
    console.log(
      JSON.stringify({
        preparadoParaNavegador: true,
        usuario: actor.username,
        jefe: chief.username,
        areaId: a.areaId,
        otraArea: b.areaId,
        alertaUI: ui,
        alertaSeguridad: security,
        usuarioFinanciero: chief.id,
        prefijo: run,
      }),
    );
    console.log('Pulse Enter al terminar el navegador para desactivar cuentas y áreas QA.');
    await input.read();
  }
} catch (error) {
  console.log(
    JSON.stringify({ error: error instanceof Error ? error.message : 'Error de integración' }),
  );
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    verifyTestDatabase();
  } catch {
    console.log('Limpieza incompleta: revisar únicamente los IDs QA.');
    process.exitCode = 1;
  }
  console.log(
    JSON.stringify({
      ejecucion: run,
      comprobaciones: checks.length,
      aprobadas: checks.filter((item) => item.aprobada).length,
      registros: owned,
    }),
  );
  admin = undefined;
  testPassword = '';
  input.close();
}
