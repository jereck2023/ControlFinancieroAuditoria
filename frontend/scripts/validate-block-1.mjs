// Targeted real validation O4 and QA preparation/cleanup for browser validation O2.
// Credentials stay in memory; never print response bodies containing session data.
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';

const run = `QA_B1_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const owned = { area: null, users: [], record: null };
const input = hiddenLines();
let secret = '';
let admin;
let actor;
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  console.log(`APROBADO: ${message}`);
};
async function request(method, path, token, body) {
  verifyTestDatabase();
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    const match = path.match(/^\/(usuarios|areas|registros-financieros)\/(\d+)/);
    if (
      match &&
      !(
        match[1] === 'usuarios' ? owned.users : match[1] === 'areas' ? [owned.area] : [owned.record]
      ).includes(Number(match[2]))
    )
      throw new Error('Escritura sobre ID ajeno bloqueada.');
    if (path === '/areas' && !body.nombre.startsWith(run)) throw new Error('Área ajena.');
    if (
      path === '/usuarios' &&
      (!body.nombreUsuario.startsWith(run.toLowerCase()) || body.areaId !== owned.area)
    )
      throw new Error('Usuario ajeno.');
    // Empty descriptions are intentionally allowed ONLY with this run's own financial actor.
    if (path.startsWith('/registros-financieros') && token !== actor)
      throw new Error('Actor financiero ajeno.');
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
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* No body is printed. */
  }
  return { status: response.status, data };
}
async function login(username, password) {
  const response = await request('POST', '/auth/login', null, { username, password });
  if (response.status !== 200 || !response.data?.token)
    throw new Error('No se obtuvo sesión de pruebas.');
  return response.data.token;
}
function counts() {
  verifyTestDatabase();
  const id = owned.users[0];
  if (!Number.isInteger(id)) throw new Error('Falta actor QA.');
  const text = execFileSync(
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
      '-W',
      '-Q',
      `SET NOCOUNT ON; SELECT (SELECT COUNT(*) FROM RegistrosFinancieros WHERE UsuarioId=${id}) registros, (SELECT COUNT(*) FROM HistorialesAuditoria WHERE UsuarioId=${id}) historiales, (SELECT COUNT(*) FROM HistorialesAuditoria WHERE UsuarioId=${id} AND TipoAccion='Modificacion') modificaciones FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  return JSON.parse(text.trim());
}
try {
  console.log('Credencial admin por stdin oculto:');
  secret = await input.read();
  verifyTestDatabase();
  console.log('Conexión efectiva exclusiva a ControlFinancieroDB_Pruebas confirmada.');
  admin = await login('admin', secret);
  const area = await request('POST', '/areas', admin, { nombre: `${run}_A` });
  if (area.status !== 201) throw new Error('No se creó área QA.');
  owned.area = area.data.areaId;
  const initial = `Aa1!${randomUUID()}`;
  const final = `Bb2!${randomUUID()}`;
  const username = `${run.toLowerCase()}.api`;
  const user = await request('POST', '/usuarios', admin, {
    nombreUsuario: username,
    nombreCompleto: `${run} API`,
    passwordInicial: initial,
    areaId: owned.area,
    roles: ['PersonalArea'],
  });
  if (user.status !== 201) throw new Error('No se creó actor QA.');
  owned.users.push(user.data.usuario.id);
  const first = await login(username, initial);
  const changed = await request('POST', '/auth/cambiar-password', first, {
    passwordActual: initial,
    passwordNueva: final,
  });
  if (changed.status !== 200) throw new Error('No se preparó actor QA.');
  actor = await login(username, final);
  const payload = {
    tipoOperacion: 'Ingreso',
    descripcion: '',
    fechaOperacion: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
      new Date(),
    ),
    monto: 10.25,
  };
  const before = counts();
  for (const empty of ['', '   ']) {
    const rejected = await request('POST', '/registros-financieros', actor, {
      ...payload,
      descripcion: empty,
    });
    assert(
      rejected.status === 400,
      `O4 creación descripción ${empty.length ? 'espacios' : 'vacía'} HTTP 400`,
    );
    assert(
      JSON.stringify(counts()) === JSON.stringify(before),
      'O4 rechazo de creación sin registro ni historial persistido',
    );
  }
  const baseline = await request('POST', '/registros-financieros', actor, {
    ...payload,
    descripcion: `${run} O4_BASE`,
  });
  if (baseline.status !== 201) throw new Error('No se creó base financiera QA.');
  owned.record = baseline.data.registroId;
  const original = await request('GET', `/registros-financieros/${owned.record}`, actor);
  if (original.status !== 200 || !original.data.rowVersion)
    throw new Error('No se obtuvo versión QA.');
  const history = counts();
  for (const empty of ['', '   ']) {
    const rejected = await request('PUT', `/registros-financieros/${owned.record}`, actor, {
      ...payload,
      descripcion: empty,
      rowVersion: original.data.rowVersion,
    });
    assert(
      rejected.status === 400,
      `O4 modificación descripción ${empty.length ? 'espacios' : 'vacía'} HTTP 400`,
    );
    const after = await request('GET', `/registros-financieros/${owned.record}`, actor);
    assert(
      after.status === 200 && JSON.stringify(after.data) === JSON.stringify(original.data),
      'O4 rechazo de modificación conserva todos los datos y RowVersion',
    );
    assert(
      JSON.stringify(counts()) === JSON.stringify(history) && history.modificaciones === 0,
      'O4 rechazo de modificación sin historial de éxito',
    );
  }
  console.log(
    JSON.stringify({
      run,
      areaId: owned.area,
      apiUserId: owned.users[0],
      registroId: owned.record,
      counts: counts(),
      uiUsername: `${run.toLowerCase()}.ui`,
    }),
  );
  console.log('O4 completado. Esperando Enter oculto para limpiar fixtures después de O2.');
  await input.read();
} catch (error) {
  console.log(`VALIDACIÓN INTERRUMPIDA: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    if (admin && owned.area) {
      admin = await login('admin', secret);
      const users = await request('GET', '/usuarios', admin);
      const rows = Array.isArray(users.data) ? users.data : [];
      for (const user of rows.filter(
        (item) => item.userName?.startsWith(run.toLowerCase()) && item.areaId === owned.area,
      )) {
        if (!owned.users.includes(user.id)) owned.users.push(user.id);
        if (user.activo) {
          const result = await request('PUT', `/usuarios/${user.id}/desactivar`, admin, {});
          assert(result.status === 200, `Limpieza cuenta QA ${user.id}`);
        }
        console.log(`Cuenta QA conservada inactiva: ${user.id} ${user.userName}`);
      }
      const result = await request('PATCH', `/areas/${owned.area}/desactivar`, admin, {});
      assert(result.status === 200, `Limpieza área QA ${owned.area}`);
      console.log('Trazabilidad conservada; no se eliminaron registros, historial ni bitácora.');
    }
  } catch (error) {
    console.log(`LIMPIEZA PENDIENTE: ${error.message}`);
    process.exitCode = 1;
  }
  secret = '';
  admin = null;
  actor = null;
  input.close();
}
