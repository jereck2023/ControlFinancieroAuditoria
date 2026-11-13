import { randomUUID } from 'node:crypto';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
import { makeXlsx } from './testing/xlsx-fixture.mjs';

const base = 'http://localhost:4200/api';
const run = `QA_M56_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
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
  let data = null;
  try {
    data = JSON.parse(await response.text(), (key, value, context) =>
      /^monto$/i.test(key) && typeof value === 'number' ? context.source : value,
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
async function record(token, name, amount = '10.25') {
  const body = `{"tipoOperacion":"Ingreso","descripcion":"${run} ${name}","fechaOperacion":"2026-11-11","monto":${amount}}`;
  const result = check(
    `Preparar registro ${name}`,
    await req('POST', '/registros-financieros', token, body),
    201,
  );
  owned.records.push(result.registroId);
  return (await req('GET', `/registros-financieros/${result.registroId}`, token)).data;
}
async function modify(token, original, description, amount) {
  const body = `{"tipoOperacion":"Ingreso","descripcion":${JSON.stringify(`${run} ${description}`)},"fechaOperacion":"2026-11-11","monto":${amount},"rowVersion":${JSON.stringify(original.rowVersion)}}`;
  check(
    'Preparar modificación trazable',
    await req('PUT', `/registros-financieros/${original.registroFinancieroId}`, token, body),
    200,
  );
}
async function document(token, suffix) {
  const bytes = makeXlsx([['Ingreso', `${run} DOCUMENTO_${suffix}`, '11/11/2026', 4.25]]);
  const filename = `${run}_${suffix}.xlsx`;
  const data = () => {
    const form = new FormData();
    form.append('archivo', new Blob([bytes]), filename);
    return form;
  };
  const preview = await req(
    'POST',
    '/registros-financieros/importar/vista-previa',
    token,
    null,
    data(),
  );
  if (!preview.data?.esValido) throw new Error('No se pudo preparar documento QA.');
  const form = data();
  form.append('hashArchivo', preview.data.hashArchivo);
  const result = check(
    `Preparar documento ${suffix}`,
    await req('POST', '/registros-financieros/importar/confirmar', token, null, form),
    200,
  );
  owned.documents.push(result.documentoFinancieroId);
  owned.records.push(...result.registrosIds);
  return result.documentoFinancieroId;
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
try {
  let password = await input.read();
  testPassword = await input.read();
  if (!password || !testPassword) throw new Error('Faltan credenciales de ejecución.');
  verifyTestDatabase();
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
  const actor = await user(a.areaId, 'consulta');
  const other = await user(b.areaId, 'otraarea');
  const original = await record(actor.token, 'ANTES');
  await modify(actor.token, original, 'DESPUES <b>solo texto</b>', '20.50');
  const maximum = await record(actor.token, 'MONTO_MAXIMO_ANTES', '9999999999999999.98');
  await modify(actor.token, maximum, 'MONTO_MAXIMO_DESPUES', '9999999999999999.99');
  const foreign = await record(other.token, 'OTRA_AREA');
  const docA = await document(actor.token, 'A');
  const docB = await document(other.token, 'B');
  await roles(actor, ['Auditor']);
  const historyPath = '/historial-auditoria';
  const activityPath = '/bitacora-actividades';
  check('Historial sin JWT', await req('GET', historyPath, null), 401);
  check('Bitácora sin JWT', await req('GET', activityPath, null), 401);
  const filtered = check(
    'Historial por registro y acción',
    await req(
      'GET',
      query(historyPath, {
        registroFinancieroId: original.registroFinancieroId,
        tipoAccion: 'Modificacion',
        pagina: 1,
        tamanoPagina: 20,
      }),
      actor.token,
    ),
    200,
  );
  if (filtered.registros.length !== 1) throw new Error('La modificación preparada no es única.');
  const modification = filtered.registros[0];
  const detail = check(
    'Detalle: quién, cuándo y valores anteriores/nuevos',
    await req('GET', `${historyPath}/${modification.historialAuditoriaId}`, actor.token),
    200,
  );
  if (
    detail.usuarioId !== actor.id ||
    !detail.fechaHora ||
    detail.valoresModificados.Anteriores.Monto !== '10.25' ||
    detail.valoresModificados.Nuevos.Monto !== '20.50' ||
    !detail.valoresModificados.Nuevos.Descripcion.includes('DESPUES')
  )
    throw new Error('El detalle no coincide con la modificación QA.');
  const largeEvents = check(
    'Historial del importe máximo',
    await req(
      'GET',
      query(historyPath, {
        registroFinancieroId: maximum.registroFinancieroId,
        tipoAccion: 'Modificacion',
      }),
      actor.token,
    ),
    200,
  );
  const largeDetail = check(
    'Importes exactos dentro de ValoresModificados',
    await req(
      'GET',
      `${historyPath}/${largeEvents.registros[0].historialAuditoriaId}`,
      actor.token,
    ),
    200,
  );
  if (
    largeDetail.valoresModificados.Anteriores.Monto !== '9999999999999999.98' ||
    largeDetail.valoresModificados.Nuevos.Monto !== '9999999999999999.99'
  )
    throw new Error('Los importes históricos no son exactos.');
  const h1 = check(
    'Historial: página 1 del servidor',
    await req(
      'GET',
      query(historyPath, {
        registroFinancieroId: original.registroFinancieroId,
        pagina: 1,
        tamanoPagina: 1,
      }),
      actor.token,
    ),
    200,
  );
  const h2 = check(
    'Historial: página 2 del servidor',
    await req(
      'GET',
      query(historyPath, {
        registroFinancieroId: original.registroFinancieroId,
        pagina: 2,
        tamanoPagina: 1,
      }),
      actor.token,
    ),
    200,
  );
  if (
    h1.totalRegistros !== 2 ||
    h1.totalPaginas !== 2 ||
    h1.registros[0].historialAuditoriaId === h2.registros[0].historialAuditoriaId
  )
    throw new Error('Paginación de historial incoherente.');
  check(
    'Historial por usuario',
    await req('GET', query(historyPath, { usuarioId: actor.id }), actor.token),
    200,
  );
  const hd = await req('GET', query(historyPath, { documentoFinancieroId: docA }), actor.token);
  check(
    'Historial por documento',
    hd,
    200,
    hd.data.registros.length === 1 &&
      hd.data.registros.every((item) => item.documentoFinancieroId === docA),
  );
  const stamp = modification.fechaHora.endsWith('Z')
    ? modification.fechaHora
    : modification.fechaHora + 'Z';
  const dated = await req(
    'GET',
    query(historyPath, {
      registroFinancieroId: original.registroFinancieroId,
      fechaDesde: stamp,
      fechaHasta: stamp,
    }),
    actor.token,
  );
  check(
    'Historial por intervalo UTC exacto',
    dated,
    200,
    dated.data.registros.length === 1 &&
      dated.data.registros[0].historialAuditoriaId === modification.historialAuditoriaId,
  );
  const logs = check(
    'Bitácora por usuario y tipo exacto',
    await req(
      'GET',
      query(activityPath, {
        usuarioId: actor.id,
        tipoActividad: 'LoginExitoso',
        pagina: 1,
        tamanoPagina: 1,
      }),
      actor.token,
    ),
    200,
  );
  const logs2 = await req(
    'GET',
    query(activityPath, {
      usuarioId: actor.id,
      tipoActividad: 'LoginExitoso',
      pagina: 2,
      tamanoPagina: 1,
    }),
    actor.token,
  );
  check(
    'Bitácora: segunda página del servidor',
    logs2,
    200,
    logs.totalRegistros >= 2 &&
      logs.registros[0].bitacoraActividadId !== logs2.data.registros[0].bitacoraActividadId,
  );
  const logDetail = check(
    'Detalle de bitácora con IP y descripción',
    await req('GET', `${activityPath}/${logs.registros[0].bitacoraActividadId}`, actor.token),
    200,
  );
  if (
    logDetail.usuarioId !== actor.id ||
    !Object.hasOwn(logDetail, 'direccionIp') ||
    !Object.hasOwn(logDetail, 'detalle') ||
    logDetail.tipoActividad !== 'LoginExitoso'
  )
    throw new Error('Detalle de actividad no corresponde.');
  const logStamp = logDetail.fechaHora.endsWith('Z')
    ? logDetail.fechaHora
    : logDetail.fechaHora + 'Z';
  const exactLog = await req(
    'GET',
    query(activityPath, { usuarioId: actor.id, fechaDesde: logStamp, fechaHasta: logStamp }),
    actor.token,
  );
  check(
    'Bitácora por intervalo UTC exacto',
    exactLog,
    200,
    exactLog.data.registros.some(
      (item) => item.bitacoraActividadId === logDetail.bitacoraActividadId,
    ),
  );
  const ld = await req('GET', query(activityPath, { documentoFinancieroId: docA }), actor.token);
  check(
    'Bitácora por documento',
    ld,
    200,
    ld.data.registros.length > 0 &&
      ld.data.registros.every((item) => item.documentoFinancieroId === docA),
  );
  check(
    'Historial vacío con ID inexistente',
    await req('GET', query(historyPath, { registroFinancieroId: 2147483647 }), actor.token),
    200,
  );
  const emptyLog = await req(
    'GET',
    query(activityPath, { tipoActividad: run + '_INEXISTENTE' }),
    actor.token,
  );
  check(
    'Bitácora vacía con tipo inexistente',
    emptyLog,
    200,
    emptyLog.data.totalRegistros === 0 && emptyLog.data.registros.length === 0,
  );
  for (const path of [historyPath, activityPath]) {
    for (const [label, params] of [
      ['Página inválida', { pagina: 0 }],
      ['Tamaño inválido', { tamanoPagina: 101 }],
      ['Usuario inválido', { usuarioId: -1 }],
      [
        'Fechas invertidas',
        { fechaDesde: '2026-01-02T00:00:00Z', fechaHasta: '2026-01-01T00:00:00Z' },
      ],
    ])
      check(`${label} ${path}`, await req('GET', query(path, params), actor.token), 400);
    check(`Detalle inexistente ${path}`, await req('GET', path + '/2147483647', actor.token), 404);
  }
  check(
    'Acción de historial no admitida',
    await req('GET', query(historyPath, { tipoAccion: 'Eliminacion' }), actor.token),
    400,
  );
  check(
    'Registro de historial inválido',
    await req('GET', query(historyPath, { registroFinancieroId: -1 }), actor.token),
    400,
  );
  check(
    'Documento de bitácora inválido',
    await req('GET', query(activityPath, { documentoFinancieroId: -1 }), actor.token),
    400,
  );
  const foreignHistory = (
    await req(
      'GET',
      query(historyPath, { registroFinancieroId: foreign.registroFinancieroId }),
      actor.token,
    )
  ).data.registros[0];
  const foreignLog = (
    await req(
      'GET',
      query(activityPath, { usuarioId: other.id, tipoActividad: 'LoginExitoso' }),
      actor.token,
    )
  ).data.registros[0];
  const roleNames = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'];
  for (let mask = 1; mask < 16; mask++) {
    const assigned = roleNames.filter((_, bit) => mask & (1 << bit));
    const label = assigned.join('+');
    await roles(actor, assigned);
    const allowed =
      assigned.includes('Auditor') ||
      (assigned.includes('JefeArea') && !assigned.includes('Administrador'));
    const global = assigned.includes('Auditor');
    const history = await req('GET', query(historyPath, { usuarioId: actor.id }), actor.token);
    check(
      `Historial ${label}`,
      history,
      allowed ? 200 : 403,
      !allowed || global || history.data.registros.every((item) => item.areaId === a.areaId),
    );
    const activity = await req('GET', query(activityPath, { usuarioId: actor.id }), actor.token);
    check(
      `Bitácora ${label}`,
      activity,
      allowed ? 200 : 403,
      !allowed || global || activity.data.registros.every((item) => item.areaId === a.areaId),
    );
    check(
      `Detalle de historial de otra área ${label}`,
      await req('GET', `${historyPath}/${foreignHistory.historialAuditoriaId}`, actor.token),
      !allowed ? 403 : global ? 200 : 404,
    );
    check(
      `Detalle de bitácora de otra área ${label}`,
      await req('GET', `${activityPath}/${foreignLog.bitacoraActividadId}`, actor.token),
      !allowed ? 403 : global ? 200 : 404,
    );
    if (allowed) {
      const external = await req(
        'GET',
        query(historyPath, { registroFinancieroId: foreign.registroFinancieroId }),
        actor.token,
      );
      check(
        `Filtro no amplía historial ${label}`,
        external,
        200,
        global ? external.data.totalRegistros > 0 : external.data.totalRegistros === 0,
      );
      const externalLog = await req(
        'GET',
        query(activityPath, { usuarioId: other.id }),
        actor.token,
      );
      check(
        `Filtro no amplía bitácora ${label}`,
        externalLog,
        200,
        global ? externalLog.data.totalRegistros > 0 : externalLog.data.totalRegistros === 0,
      );
    }
  }
  await req('PATCH', `/areas/${a.areaId}/desactivar`, admin, {});
  await roles(actor, ['JefeArea']);
  check(
    'Jefe de área inactiva: historial bloqueado',
    await req('GET', historyPath, actor.token),
    403,
  );
  check(
    'Jefe de área inactiva: bitácora bloqueada',
    await req('GET', activityPath, actor.token),
    403,
  );
  await roles(actor, ['Auditor']);
  check(
    'Auditor con área inactiva: historial global',
    await req('GET', historyPath, actor.token),
    200,
  );
  check(
    'Auditor con área inactiva: bitácora global',
    await req('GET', activityPath, actor.token),
    200,
  );
  await req('PATCH', `/areas/${a.areaId}/activar`, admin, {});
  if (process.argv.includes('--ui')) {
    console.log(
      JSON.stringify({
        preparadoParaNavegador: true,
        usuario: actor.username,
        usuarioId: actor.id,
        registro: original.registroFinancieroId,
        historial: modification.historialAuditoriaId,
        historialMontoMaximo: largeEvents.registros[0].historialAuditoriaId,
        documento: docA,
        actividad: logs.registros[0].bitacoraActividadId,
        fechaHistorial: modification.fechaHora,
        fechaBitacora: logDetail.fechaHora,
        prefijo: run,
      }),
    );
    console.log('Pulse Enter al terminar el navegador para limpiar las cuentas y áreas propias.');
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
    console.log('Limpieza incompleta: revisar únicamente los IDs QA del resumen.');
    process.exitCode = 1;
  }
  console.log(
    JSON.stringify({
      ejecucion: run,
      comprobaciones: checks.length,
      aprobadas: checks.filter((item) => item.aprobada).length,
      registros: owned,
      nota: 'Historial y bitácora se generaron por operaciones normales; no se editaron ni eliminaron. Los datos QA permanecen identificados para auditoría.',
    }),
  );
  admin = undefined;
  testPassword = '';
  input.close();
}
