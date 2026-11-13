import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeXlsx, readZip } from './testing/xlsx-fixture.mjs';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';

const base = 'http://localhost:4200/api';
const run = `QA_M4_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const owned = { areas: [], users: [], records: [], documents: [] };
const checks = [];
let admin;
let operator;
let adminPassword;
let testPassword;
const input = hiddenLines();
console.log(
  'Ingrese por stdin dos líneas ocultas: credencial admin y credencial temporal QA. No se mostrarán ni guardarán.',
);
async function req(method, path, token, body, upload) {
  verifyTestDatabase(); // Some GETs also write audit logs.
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    const match = path.match(/^\/(areas|usuarios|registros-financieros)\/(\d+)/);
    const group =
      match && { areas: 'areas', usuarios: 'users', 'registros-financieros': 'records' }[match[1]];
    if (match && !owned[group].includes(Number(match[2]))) throw new Error('ID ajeno bloqueado.');
    if (path === '/areas' && !body.nombre.startsWith(run))
      throw new Error('Prefijo de área inválido.');
    if (path === '/usuarios' && !body.nombreUsuario.startsWith(run.toLowerCase()))
      throw new Error('Prefijo de cuenta inválido.');
    const recordBody = typeof body === 'string' ? JSON.parse(body) : body;
    if (path === '/registros-financieros' && !recordBody.descripcion?.startsWith(run))
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
  if ((response.headers.get('Content-Type') ?? '').includes('spreadsheetml'))
    return {
      status: response.status,
      bytes: Buffer.from(await response.arrayBuffer()),
      type: response.headers.get('Content-Type'),
    };
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text, (key, value, context) =>
      key === 'monto' && typeof value === 'number' ? context.source : value,
    );
  } catch {
    /* Non-JSON errors remain opaque. */
  }
  return { status: response.status, data };
}
function check(name, response, status, condition = true) {
  const passed = response.status === status && condition;
  checks.push({ prueba: name, esperado: status, obtenido: response.status, aprobada: passed });
  console.log(JSON.stringify(checks.at(-1)));
  if (!passed) throw new Error(`Falló ${name}; HTTP ${response.status}`);
  return response.data;
}
async function login(username, password) {
  const r = await req('POST', '/auth/login', null, { username, password });
  if (r.status !== 200 || !r.data?.token) throw new Error('No se pudo preparar una sesión QA.');
  return r.data.token;
}
function form(bytes, filename, hash) {
  const data = new FormData();
  data.append(
    'archivo',
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  );
  if (hash !== undefined) data.append('hashArchivo', hash);
  return data;
}
async function setupUser(area, suffix) {
  const initial = 'Aa1!' + randomUUID();
  const username = `${run.toLowerCase()}.${suffix}`;
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
  const token = await login(username, initial);
  check(
    `Preparar contraseña de ${suffix}`,
    await req('POST', '/auth/cambiar-password', token, {
      passwordActual: initial,
      passwordNueva: testPassword,
    }),
    200,
  );
  return { id: created.usuario.id, username, token: await login(username, testPassword) };
}
const template = { tipoOperacion: 'Ingreso', fechaOperacion: '2026-11-11', monto: 10.25 };
async function create(token, suffix) {
  const r = check(
    `Crear registro ${suffix}`,
    await req('POST', '/registros-financieros', token, {
      ...template,
      descripcion: `${run} ${suffix}`,
    }),
    201,
  );
  owned.records.push(r.registroId);
  return (await req('GET', `/registros-financieros/${r.registroId}`, token)).data;
}
async function cleanup() {
  if (!admin) return;
  for (const id of owned.users) {
    const user = await req('GET', `/usuarios/${id}`, admin);
    if (!user.data?.userName.startsWith(run.toLowerCase()))
      throw new Error('Limpieza de cuenta ajena bloqueada.');
    if (user.data.activo)
      check(`Limpiar cuenta ${id}`, await req('PUT', `/usuarios/${id}/desactivar`, admin, {}), 200);
  }
  const areas = (await req('GET', '/areas', admin)).data;
  for (const id of owned.areas) {
    const area = areas.find((item) => item.areaId === id);
    if (!area?.nombre.startsWith(run)) throw new Error('Limpieza de área ajena bloqueada.');
    if (area.activo)
      check(`Limpiar área ${id}`, await req('PATCH', `/areas/${id}/desactivar`, admin, {}), 200);
  }
}
try {
  adminPassword = await input.read();
  testPassword = await input.read();
  if (!adminPassword || !testPassword) throw new Error('Faltan credenciales de ejecución.');
  verifyTestDatabase();
  admin = await login('admin', adminPassword);
  adminPassword = '';
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
  operator = await setupUser(a.areaId, 'operador');
  const other = await setupUser(b.areaId, 'otraarea');
  let record = await create(operator.token, 'MANUAL');
  const foreign = await create(other.token, 'OTRA_AREA');
  const update = {
    ...template,
    descripcion: `${run} MODIFICADO`,
    monto: 15.35,
    rowVersion: record.rowVersion,
  };
  check(
    'Actualizar con RowVersion vigente',
    await req(
      'PUT',
      `/registros-financieros/${record.registroFinancieroId}`,
      operator.token,
      update,
    ),
    200,
  );
  check(
    'Rechazar RowVersion obsoleto',
    await req('PUT', `/registros-financieros/${record.registroFinancieroId}`, operator.token, {
      ...update,
      descripcion: `${run} NO_DEBE_GUARDARSE`,
    }),
    409,
  );
  const current = await req(
    'GET',
    `/registros-financieros/${record.registroFinancieroId}`,
    operator.token,
  );
  check(
    'Conflicto no sobrescribe datos',
    current,
    200,
    current.data.descripcion === update.descripcion && current.data.monto === '15.35',
  );
  record = current.data;
  check(
    'Actualización sin cambios',
    await req('PUT', `/registros-financieros/${record.registroFinancieroId}`, operator.token, {
      ...update,
      rowVersion: record.rowVersion,
    }),
    200,
  );
  check(
    'RowVersion inválido',
    await req('PUT', `/registros-financieros/${record.registroFinancieroId}`, operator.token, {
      ...update,
      rowVersion: 'invalido',
    }),
    400,
  );
  for (const [label, body] of [
    ['Monto cero', { monto: 0 }],
    ['Monto negativo', { monto: -1 }],
    ['Fecha inválida', { fechaOperacion: '2026-02-29' }],
  ])
    check(
      label,
      await req('POST', '/registros-financieros', operator.token, {
        ...template,
        descripcion: `${run} INVALIDO`,
        ...body,
      }),
      400,
    );
  const large = check(
    'Crear monto máximo sin redondeo del cliente',
    await req(
      'POST',
      '/registros-financieros',
      operator.token,
      `{"tipoOperacion":"Ingreso","descripcion":"${run} MONTO_MAXIMO","fechaOperacion":"2026-11-11","monto":9999999999999999.99}`,
    ),
    201,
  );
  owned.records.push(large.registroId);
  const largeRead = await req('GET', `/registros-financieros/${large.registroId}`, operator.token);
  check(
    'API conserva monto máximo exacto',
    largeRead,
    200,
    largeRead.data.monto === '9999999999999999.99',
  );
  const rows = [
    ['Ingreso', `${run} IMPORTADO_1`, '11/11/2026', 10.25],
    ['Egreso', `${run} IMPORTADO_2`, '11/11/2026', 2.75],
  ];
  const bytes = makeXlsx(rows);
  const filename = `${run}.xlsx`;
  const preview = check(
    'Vista previa válida',
    await req(
      'POST',
      '/registros-financieros/importar/vista-previa',
      operator.token,
      null,
      form(bytes, filename),
    ),
    200,
  );
  if (
    !preview.esValido ||
    preview.registros.length !== 2 ||
    preview.hashArchivo !== createHash('sha256').update(bytes).digest('hex').toUpperCase()
  )
    throw new Error('Vista previa válida no coincide con archivo.');
  for (const [label, fixture] of [
    ['Hoja incorrecta', makeXlsx(rows, { sheet: 'Incorrecta' })],
    [
      'Encabezado incorrecto',
      makeXlsx(rows, { headers: ['Tipo', 'Descripcion', 'FechaOperacion', 'Monto'] }),
    ],
    ['Fórmula', makeXlsx(rows, { formula: true })],
    ['Monto inválido en fila', makeXlsx([['Ingreso', `${run} ERROR`, '11/11/2026', 0]])],
    [
      'Más de 500 filas',
      makeXlsx(Array.from({ length: 501 }, (_, i) => ['Ingreso', `${run} ${i}`, '11/11/2026', 1])),
    ],
  ]) {
    const r = await req(
      'POST',
      '/registros-financieros/importar/vista-previa',
      operator.token,
      null,
      form(fixture, filename),
    );
    check(label, r, 200, r.data?.esValido === false && r.data.errores.length > 0);
    if (label === 'Monto inválido en fila')
      check(
        'Confirmación rechaza filas inválidas',
        await req(
          'POST',
          '/registros-financieros/importar/confirmar',
          operator.token,
          null,
          form(fixture, filename, r.data.hashArchivo),
        ),
        400,
      );
  }
  check(
    'Rechazar extensión incorrecta',
    await req(
      'POST',
      '/registros-financieros/importar/vista-previa',
      operator.token,
      null,
      form(bytes, `${run}.xls`),
    ),
    400,
  );
  check(
    'Rechazar archivo mayor de 2 MB',
    await req(
      'POST',
      '/registros-financieros/importar/vista-previa',
      operator.token,
      null,
      form(Buffer.alloc(2 * 1024 * 1024 + 1), filename),
    ),
    400,
  );
  check(
    'Rechazar hash que no corresponde',
    await req(
      'POST',
      '/registros-financieros/importar/confirmar',
      operator.token,
      null,
      form(bytes, filename, 'HASH_DISTINTO'),
    ),
    400,
  );
  const imported = check(
    'Confirmar archivo validado',
    await req(
      'POST',
      '/registros-financieros/importar/confirmar',
      operator.token,
      null,
      form(bytes, filename, preview.hashArchivo),
    ),
    200,
  );
  owned.documents.push(imported.documentoFinancieroId);
  owned.records.push(...imported.registrosIds);
  check(
    'Rechazar importación duplicada en misma área',
    await req(
      'POST',
      '/registros-financieros/importar/confirmar',
      operator.token,
      null,
      form(bytes, filename, preview.hashArchivo),
    ),
    409,
  );
  const importedB = check(
    'Mismo archivo permitido en otra área',
    await req(
      'POST',
      '/registros-financieros/importar/confirmar',
      other.token,
      null,
      form(bytes, filename, preview.hashArchivo),
    ),
    200,
  );
  owned.documents.push(importedB.documentoFinancieroId);
  owned.records.push(...importedB.registrosIds);
  const detail = await req(
    'GET',
    `/documentos-financieros/${imported.documentoFinancieroId}`,
    operator.token,
  );
  check(
    'Detalle de documento importado',
    detail,
    200,
    detail.data.totalRegistros === 2 && detail.data.hashArchivo === preview.hashArchivo,
  );
  const importedRecords = await req(
    'GET',
    `/documentos-financieros/${imported.documentoFinancieroId}/registros`,
    operator.token,
  );
  check(
    'Consultar registros del documento',
    importedRecords,
    200,
    importedRecords.data.length === 2 &&
      importedRecords.data.every((item) => item.areaId === a.areaId),
  );
  const exported = await req(
    'GET',
    `/documentos-financieros/${imported.documentoFinancieroId}/exportar`,
    operator.token,
  );
  check('Exportar XLSX real de documento', exported, 200, !!exported.bytes);
  const exportedXml = Object.values(readZip(exported.bytes)).join('');
  if (!exportedXml.includes(`${run} IMPORTADO_1`) || !exportedXml.includes('10.25'))
    throw new Error('La exportación no contiene los datos esperados.');
  const allExport = await req('GET', '/registros-financieros/exportar', operator.token);
  const allXml = allExport.bytes ? Object.values(readZip(allExport.bytes)).join('') : '';
  check(
    'Exportación general del alcance',
    allExport,
    200,
    !!allExport.bytes &&
      allXml.includes(`${run} MODIFICADO`) &&
      !allXml.includes(`${run} OTRA_AREA`),
  );
  const roles = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'];
  for (let mask = 1; mask < 16; mask++) {
    const assigned = roles.filter((_, bit) => mask & (1 << bit));
    const name = assigned.join('+');
    const changed = await req('PUT', `/usuarios/${operator.id}/roles`, admin, { roles: assigned });
    if (changed.status !== 200) throw new Error('No se pudo preparar combinación de roles.');
    operator.token = await login(operator.username, testPassword);
    const canRead = assigned.some((role) => role !== 'Administrador');
    const canWrite = assigned.includes('PersonalArea');
    const global = assigned.includes('Auditor');
    const records = await req('GET', '/registros-financieros', operator.token);
    check(
      `Lectura ${name}`,
      records,
      canRead ? 200 : 403,
      !canRead || global || records.data.every((item) => item.areaId === a.areaId),
    );
    const docs = await req('GET', '/documentos-financieros', operator.token);
    check(
      `Documentos ${name}`,
      docs,
      canRead ? 200 : 403,
      !canRead || global || docs.data.every((item) => item.areaId === a.areaId),
    );
    const doc = await req(
      'GET',
      `/documentos-financieros/${importedB.documentoFinancieroId}`,
      operator.token,
    );
    check(`Documento de otra área ${name}`, doc, !canRead ? 403 : global ? 200 : 404);
    const created = await req('POST', '/registros-financieros', operator.token, {
      ...template,
      descripcion: `${run} COMBINACION_${mask}`,
    });
    check(`Creación ${name}`, created, canWrite ? 201 : 403);
    if (canWrite) owned.records.push(created.data.registroId);
    check(
      `Edición fuera de área ${name}`,
      await req('PUT', `/registros-financieros/${foreign.registroFinancieroId}`, operator.token, {
        ...template,
        descripcion: `${run} NO_DEBE_EDITAR_OTRA_AREA`,
        rowVersion: foreign.rowVersion,
      }),
      canWrite ? 404 : 403,
    );
  }
  await req('PATCH', `/areas/${a.areaId}/desactivar`, admin, {});
  await req('PUT', `/usuarios/${operator.id}/roles`, admin, { roles: ['PersonalArea', 'Auditor'] });
  operator.token = await login(operator.username, testPassword);
  check(
    'Auditor combinado consulta con área propia inactiva',
    await req('GET', '/registros-financieros', operator.token),
    200,
  );
  check(
    'Auditor combinado no crea con área propia inactiva',
    await req('POST', '/registros-financieros', operator.token, {
      ...template,
      descripcion: `${run} INACTIVA`,
    }),
    403,
  );
  await req('PATCH', `/areas/${a.areaId}/activar`, admin, {});
  await req('PUT', `/usuarios/${operator.id}/roles`, admin, { roles: ['PersonalArea'] });
  if (process.argv.includes('--ui')) {
    const fixturePath = resolve('tmp', `${run}_UI.xlsx`);
    mkdirSync(resolve('tmp'), { recursive: true });
    writeFileSync(fixturePath, makeXlsx([['Ingreso', `${run} UI_IMPORT`, '11/11/2026', 8.45]]));
    console.log(
      JSON.stringify({
        preparadoParaNavegador: true,
        usuario: operator.username,
        registro: record.registroFinancieroId,
        documento: imported.documentoFinancieroId,
        archivo: fixturePath,
        prefijo: run,
      }),
    );
    console.log(
      'Pulse Enter por stdin al terminar la prueba de navegador para limpiar cuentas y áreas propias.',
    );
    await input.read();
  }
} catch (error) {
  adminPassword = '';
  console.log(
    JSON.stringify({ error: error instanceof Error ? error.message : 'Error de validación' }),
  );
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    verifyTestDatabase();
  } catch {
    console.log('Limpieza incompleta: revisar únicamente los IDs propios del resumen.');
    process.exitCode = 1;
  }
  console.log(
    JSON.stringify({
      ejecucion: run,
      comprobaciones: checks.length,
      aprobadas: checks.filter((item) => item.aprobada).length,
      registros: owned,
      nota: 'Los registros/documentos QA se conservan para auditoría: no existe endpoint de eliminación. Cuentas/áreas propias desactivadas si limpieza aprobada.',
    }),
  );
  admin = undefined;
  testPassword = '';
  input.close();
}
