import { randomUUID } from 'node:crypto';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
import { execFileSync } from 'node:child_process';

const base = 'http://localhost:4200/api';
const run = `QA_M8_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const owned = { areas: [], users: [], records: [], documents: [] };
const checks = [];
const input = hiddenLines();
let admin;
let testPassword;
console.log(
  'Ingrese dos líneas ocultas por stdin: credencial admin y credencial temporal QA. No se guardarán.',
);
async function req(method, path, token, body, upload) {
  verifyTestDatabase();
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
const detectionResults = [];
async function detect(token, expected, label) {
  const response = await req('POST', '/anomalias/detectar', token);
  const valid =
    expected !== 200 ||
    (typeof response.data?.mensaje === 'string' &&
      Number.isSafeInteger(response.data?.nuevasAlertas) &&
      response.data.nuevasAlertas >= 0);
  check(label, response, expected, valid);
  if (expected === 200) {
    detectionResults.push(response.data.nuevasAlertas);
    console.log(JSON.stringify({ resultadoDeteccionReal: response.data }));
  }
  return response;
}
try {
  let password = await input.read();
  testPassword = await input.read();
  if (!password || !testPassword) throw new Error('Faltan credenciales de ejecución.');
  const configured = sqlJson(
    'SELECT Codigo,Activa,Umbral,VentanaMinutos,FechaUltimaEvaluacionUtc FROM ReglasAnomalia',
  );
  const repeated = configured.find((rule) => rule.Codigo === 'MODIFICACION_REITERADA');
  const loginRule = configured.find((rule) => rule.Codigo === 'LOGIN_FALLIDO_REITERADO');
  assertion(
    'Reglas de casos pequeños activas y umbrales compatibles',
    !!repeated?.Activa &&
      !!loginRule?.Activa &&
      repeated.Umbral > 0 &&
      repeated.Umbral <= 5 &&
      loginRule.Umbral > 0 &&
      loginRule.Umbral <= 5 &&
      repeated.VentanaMinutos >= 5 &&
      loginRule.VentanaMinutos >= 5,
  );
  admin = await login('admin', password);
  password = '';
  const area = check(
    'Preparar área QA',
    await req('POST', '/areas', admin, { nombre: `${run}_A` }),
    201,
  );
  owned.areas.push(area.areaId);
  const actor = await user(area.areaId, 'auditor'),
    events = await user(area.areaId, 'eventos');
  await roles(actor, ['Auditor']);
  const original = await record(events.token, 'BASE', '1.00');
  let version = original.rowVersion;
  for (let i = 1; i <= repeated.Umbral; i++) {
    const changed = check(
      `Preparar modificación de descripción ${i}`,
      await req('PUT', `/registros-financieros/${original.registroFinancieroId}`, events.token, {
        tipoOperacion: 'Ingreso',
        descripcion: `${run} CAMBIO_${i}`,
        fechaOperacion: '2026-11-11',
        monto: 1,
        rowVersion: version,
      }),
      200,
    );
    version = changed.rowVersion;
  }
  const incorrect = randomUUID();
  for (let i = 1; i <= loginRule.Umbral; i++)
    check(
      `Preparar contraseña incorrecta QA ${i}`,
      await req('POST', '/auth/login', null, { username: events.username, password: incorrect }),
      401,
    );
  await detect(actor.token, 200, 'Detección manual con Auditor sobre eventos QA');
  const ownAlerts = () =>
    sqlJson(
      `SELECT r.Codigo,a.AlertaId,a.CampoModificado,a.RegistroFinancieroId FROM Alertas a JOIN ReglasAnomalia r ON r.ReglaAnomaliaId=a.ReglaAnomaliaId WHERE a.UsuarioId=${events.id} ORDER BY a.AlertaId`,
    );
  const first = ownAlerts();
  assertion(
    'Modificación reiterada QA detectada por servicio manual o worker',
    first.filter(
      (alert) =>
        alert.Codigo === 'MODIFICACION_REITERADA' &&
        alert.RegistroFinancieroId === original.registroFinancieroId &&
        alert.CampoModificado === 'Descripcion',
    ).length === 1,
  );
  assertion(
    'Contraseñas incorrectas reiteradas QA detectadas por servicio manual o worker',
    first.filter((alert) => alert.Codigo === 'LOGIN_FALLIDO_REITERADO').length === 1,
  );
  await detect(null, 401, 'Detección sin JWT rechazada');
  const names = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'];
  for (let mask = 1; mask < 16; mask++) {
    const assigned = names.filter((_, bit) => mask & (1 << bit));
    await roles(actor, assigned);
    await detect(
      actor.token,
      assigned.includes('Auditor') ? 200 : 403,
      `Detección con ${assigned.join('+')}`,
    );
  }
  const last = ownAlerts();
  assertion(
    'Evaluaciones repetidas no duplican las alertas QA de cambios y contraseñas',
    last.filter((alert) =>
      ['MODIFICACION_REITERADA', 'LOGIN_FALLIDO_REITERADO'].includes(alert.Codigo),
    ).length === 2,
  );
  const checkpoints = sqlJson(
    'SELECT Codigo,FechaUltimaEvaluacionUtc FROM ReglasAnomalia WHERE Activa=1',
  );
  assertion(
    'Reglas activas tienen seguimiento de evaluación actualizado',
    checkpoints.length > 0 &&
      checkpoints.every(
        (rule) =>
          !!rule.FechaUltimaEvaluacionUtc &&
          (!configured.find((before) => before.Codigo === rule.Codigo)?.FechaUltimaEvaluacionUtc ||
            rule.FechaUltimaEvaluacionUtc >
              configured.find((before) => before.Codigo === rule.Codigo).FechaUltimaEvaluacionUtc),
      ),
  );
  await roles(actor, ['Auditor']);
  console.log(
    JSON.stringify({
      prefijo: run,
      datosQA: owned,
      alertasQAPorRegla: last.map((alert) => alert.Codigo),
      contadoresRespuestaManual: detectionResults,
    }),
  );
  if (process.argv.includes('--ui')) {
    console.log(
      JSON.stringify({
        preparadoParaNavegador: true,
        usuario: actor.username,
        usuarioEventos: events.username,
      }),
    );
    console.log('Pulse Enter al terminar el navegador para desactivar cuentas y área QA.');
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
    console.log('Limpieza incompleta: revisar únicamente IDs QA del resumen.');
    process.exitCode = 1;
  }
  console.log(
    JSON.stringify({
      ejecucion: run,
      comprobaciones: checks.length,
      aprobadas: checks.filter((item) => item.aprobada).length,
      registros: owned,
      contadoresRespuestaManual: detectionResults,
    }),
  );
  admin = undefined;
  testPassword = '';
  input.close();
}
