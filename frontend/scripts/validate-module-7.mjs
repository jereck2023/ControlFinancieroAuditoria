import { randomUUID } from 'node:crypto';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';
import { makeXlsx } from './testing/xlsx-fixture.mjs';
import { xlsxEntries } from './testing/xlsx-inspection.mjs';

const base = 'http://localhost:4200/api';
const run = `QA_M7_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
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

const endpoints = ['resumen', 'detalle', 'resumen/exportar', 'detalle/exportar'];
const period = { fechaDesde: '2026-11-11', fechaHasta: '2026-11-11' };
async function report(endpoint, token, filters = {}, expected = 200, condition = () => true) {
  const response = await req(
    'GET',
    query(`/reportes-financieros/${endpoint}`, { ...period, ...filters }),
    token,
  );
  check(`Reporte ${endpoint} ${JSON.stringify(filters)}`, response, expected, condition(response));
  return response;
}
function workbook(response, kind) {
  const entries = xlsxEntries(response.bytes);
  if (
    !response.disposition?.includes('.xlsx') ||
    !entries.get('xl/workbook.xml')?.includes(`${kind} Financiero`) ||
    !entries.get('xl/worksheets/sheet1.xml') ||
    !entries.has('[Content_Types].xml')
  )
    throw new Error('Exportación Excel incompleta.');
  return entries;
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
  const actor = await user(a.areaId, 'reportes'),
    other = await user(b.areaId, 'otraarea');
  await record(actor.token, 'INGRESO', '10.25');
  await record(actor.token, 'EGRESO', '4.10', 'Egreso');
  await record(actor.token, 'MAXIMO', '9999999999999999.99');
  await record(other.token, 'OTRA_AREA', '3.33');
  const bytes = makeXlsx([
    ['Ingreso', `${run} DOCUMENTO_INGRESO`, '11/11/2026', 2.5],
    ['Egreso', `${run} DOCUMENTO_EGRESO`, '11/11/2026', 2.75],
  ]);
  const upload = () => {
    const form = new FormData();
    form.append('archivo', new Blob([bytes]), `${run}.xlsx`);
    return form;
  };
  const preview = await req(
    'POST',
    '/registros-financieros/importar/vista-previa',
    actor.token,
    null,
    upload(),
  );
  if (preview.status !== 200 || !preview.data?.esValido)
    throw new Error('No se pudo preparar documento QA.');
  const confirmation = upload();
  confirmation.append('hashArchivo', preview.data.hashArchivo);
  const imported = check(
    'Preparar documento QA',
    await req('POST', '/registros-financieros/importar/confirmar', actor.token, null, confirmation),
    200,
  );
  const documentId = imported.documentoFinancieroId;
  owned.documents.push(documentId);
  owned.records.push(...imported.registrosIds);
  await roles(actor, ['Auditor']);
  const own = { areaId: a.areaId };
  await report(
    'resumen',
    actor.token,
    own,
    200,
    (r) =>
      r.data.cantidadIngresos === 3 &&
      r.data.cantidadEgresos === 2 &&
      r.data.totalIngresos === '10000000000000012.74' &&
      r.data.totalEgresos === '6.85' &&
      r.data.diferencia === '10000000000000005.89',
  );
  await report(
    'resumen',
    actor.token,
    { documentoFinancieroId: documentId },
    200,
    (r) =>
      r.data.diferencia === '-0.25' &&
      r.data.totalIngresos === '2.50' &&
      r.data.totalEgresos === '2.75',
  );
  await report(
    'resumen',
    actor.token,
    { ...own, tipoOperacion: 'Egreso' },
    200,
    (r) =>
      (r.data.cantidadIngresos === 0 && r.data.totalIngresos === '0') ||
      (r.data.cantidadIngresos === 0 && r.data.totalIngresos === '0.00'),
  );
  await report(
    'resumen',
    actor.token,
    { ...own, soloSinDocumento: true },
    200,
    (r) => r.data.cantidadIngresos === 2 && r.data.cantidadEgresos === 1,
  );
  const group1 = await report(
    'resumen',
    actor.token,
    { ...own, agrupacion: 'Documento', tamanoPagina: 1, pagina: 1 },
    200,
    (r) => r.data.totalGrupos === 2 && r.data.totalPaginas === 2 && r.data.grupos.length === 1,
  );
  await report(
    'resumen',
    actor.token,
    { ...own, agrupacion: 'Documento', tamanoPagina: 1, pagina: 2 },
    200,
    (r) =>
      r.data.grupos.length === 1 &&
      r.data.grupos[0].grupoId !== group1.data.grupos[0].grupoId &&
      r.data.totalIngresos === group1.data.totalIngresos,
  );
  await report(
    'resumen',
    actor.token,
    { ...own, agrupacion: 'Area' },
    200,
    (r) => r.data.totalGrupos === 1 && r.data.grupos[0].grupoId === a.areaId,
  );
  const d1 = await report(
    'detalle',
    actor.token,
    { ...own, tamanoPagina: 1 },
    200,
    (r) =>
      r.data.totalRegistros === 5 && r.data.registros.length === 1 && r.data.totalPaginas === 5,
  );
  await report(
    'detalle',
    actor.token,
    { ...own, tamanoPagina: 1, pagina: 2 },
    200,
    (r) => r.data.registros[0].registroFinancieroId !== d1.data.registros[0].registroFinancieroId,
  );
  await report(
    'detalle',
    actor.token,
    { ...own, soloSinDocumento: true },
    200,
    (r) =>
      r.data.totalRegistros === 3 &&
      r.data.registros.every((row) => row.documentoFinancieroId === null) &&
      r.data.registros.some((row) => row.monto === '9999999999999999.99'),
  );
  await report(
    'detalle',
    actor.token,
    { documentoFinancieroId: documentId, tipoOperacion: 'Egreso' },
    200,
    (r) => r.data.totalRegistros === 1 && r.data.registros[0].monto === '2.75',
  );
  await report(
    'detalle',
    actor.token,
    { ...own, fechaDesde: '2026-11-12', fechaHasta: '2026-11-12' },
    200,
    (r) => r.data.totalRegistros === 0 && r.data.registros.length === 0,
  );
  await report(
    'resumen',
    actor.token,
    { ...own, fechaDesde: '2026-11-12', fechaHasta: '2026-11-12' },
    200,
    (r) => r.data.cantidadIngresos === 0 && r.data.cantidadEgresos === 0,
  );
  for (const endpoint of endpoints) {
    await report(endpoint, null, {}, 401);
    await report(endpoint, actor.token, { fechaDesde: '' }, 400);
    await report(endpoint, actor.token, { fechaDesde: '2026-11-12' }, 400);
    await report(endpoint, actor.token, { tipoOperacion: 'Saldo' }, 400);
    await report(endpoint, actor.token, { areaId: 0 }, 400);
    await report(endpoint, actor.token, { agrupacion: 'Usuario' }, 400);
    await report(endpoint, actor.token, { pagina: 0 }, 400);
    await report(endpoint, actor.token, { tamanoPagina: 101 }, 400);
    await report(
      endpoint,
      actor.token,
      { documentoFinancieroId: documentId, soloSinDocumento: true },
      400,
    );
    await report(endpoint, actor.token, { documentoFinancieroId: 2147483647 }, 404);
    await report(
      endpoint,
      actor.token,
      { areaId: b.areaId, documentoFinancieroId: documentId },
      400,
    );
  }
  await report('detalle', actor.token, { pagina: 2147483647, tamanoPagina: 100 }, 400);
  const summaryExport = workbook(
    await report('resumen/exportar', actor.token, {
      ...own,
      agrupacion: 'Documento',
      tamanoPagina: 1,
      pagina: 2,
    }),
    'Resumen',
  );
  const summarySheet = summaryExport.get('xl/worksheets/sheet1.xml');
  if (!summarySheet.includes('r="B20"') || !summarySheet.includes('r="G20"'))
    throw new Error('La exportación de resumen no incluyó ambos grupos.');
  const detailExport = workbook(
    await report('detalle/exportar', actor.token, { ...own, tamanoPagina: 1, pagina: 2 }),
    'Detalle',
  );
  const detailSheet = detailExport.get('xl/worksheets/sheet1.xml');
  if (!detailSheet.includes('r="A17"') || detailSheet.includes('r="A18"'))
    throw new Error('La exportación de detalle no incluyó las cinco operaciones.');
  workbook(
    await report('resumen/exportar', actor.token, {
      ...own,
      fechaDesde: '2026-11-12',
      fechaHasta: '2026-11-12',
    }),
    'Resumen',
  );
  workbook(
    await report('detalle/exportar', actor.token, {
      ...own,
      fechaDesde: '2026-11-12',
      fechaHasta: '2026-11-12',
    }),
    'Detalle',
  );
  const roleNames = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'];
  for (let mask = 1; mask < 16; mask++) {
    const assigned = roleNames.filter((_, bit) => mask & (1 << bit));
    await roles(actor, assigned);
    const allowed = assigned.includes('Auditor') || assigned.includes('JefeArea');
    for (const endpoint of endpoints) await report(endpoint, actor.token, own, allowed ? 200 : 403);
    if (allowed) {
      for (const endpoint of endpoints)
        await report(
          endpoint,
          actor.token,
          { areaId: b.areaId },
          assigned.includes('Auditor') ? 200 : 403,
        );
      if (!assigned.includes('Auditor'))
        for (const endpoint of endpoints)
          await report(endpoint, actor.token, { documentoFinancieroId: 2147483647 }, 404);
    }
  }
  await req('PATCH', `/areas/${a.areaId}/desactivar`, admin, {});
  await roles(actor, ['JefeArea']);
  for (const endpoint of endpoints) await report(endpoint, actor.token, {}, 403);
  await roles(actor, ['Auditor']);
  for (const endpoint of endpoints) await report(endpoint, actor.token, own);
  await req('PATCH', `/areas/${a.areaId}/activar`, admin, {});
  if (process.argv.includes('--ui')) {
    console.log(
      JSON.stringify({
        preparadoParaNavegador: true,
        usuario: actor.username,
        areaId: a.areaId,
        otraArea: b.areaId,
        documentoId: documentId,
        prefijo: run,
      }),
    );
    console.log('Pulse Enter al terminar el navegador para desactivar cuentas y áreas propias.');
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
    }),
  );
  admin = undefined;
  testPassword = '';
  input.close();
}
