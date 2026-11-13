// Manual integration runner. Credentials arrive only on stdin; tokens stay in memory.
// Writes are restricted to new QA_M123 records and the verified test database.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const base = 'http://localhost:4200/api';
const cleanupRun = process.argv[2];
if (cleanupRun && !/^QA_M123_\d{14}$/.test(cleanupRun))
  throw new Error('Prefijo de limpieza inválido.');
const run = cleanupRun || `QA_M123_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const username = run.toLowerCase();
const passwords = Array.from({ length: 4 }, () => `Aa1!${randomUUID()}`);
const results = [];
const owned = { areas: [], users: [] };
let adminToken;

function verifyDatabase() {
  const pid = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '(Get-NetTCPConnection -State Listen -LocalPort 7202 | Select-Object -ExpandProperty OwningProcess -Unique)',
    ],
    { encoding: 'utf8' },
  ).trim();
  if (!/^\d+$/.test(pid)) throw new Error('No se identificó un único proceso de API.');
  const databases = execFileSync(
    'sqlcmd',
    [
      '-S',
      'localhost',
      '-E',
      '-d',
      'master',
      '-b',
      '-l',
      '5',
      '-h',
      '-1',
      '-W',
      '-Q',
      `SET NOCOUNT ON; SELECT DISTINCT DB_NAME(database_id) FROM sys.dm_exec_sessions WHERE is_user_process=1 AND host_process_id=${pid};`,
    ],
    { encoding: 'utf8' },
  )
    .trim()
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (databases.length !== 1 || databases[0] !== 'ControlFinancieroDB_Pruebas')
    throw new Error('La conexión SQL no está limitada a la base de pruebas.');
}

async function request(method, path, token, body) {
  if (method !== 'GET') verifyDatabase();
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    const match = path.match(/^\/(areas|usuarios)\/(\d+)/);
    if (match && !owned[match[1] === 'usuarios' ? 'users' : 'areas'].includes(Number(match[2])))
      throw new Error('Se bloqueó una escritura sobre un ID ajeno a esta ejecución.');
    if (method === 'POST' && path === '/areas' && !body?.nombre.startsWith(run))
      throw new Error('Área sin prefijo de pruebas.');
    if (method === 'POST' && path === '/usuarios' && !body?.nombreUsuario.startsWith(username))
      throw new Error('Usuario sin prefijo de pruebas.');
  }
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* 401/403 may have empty bodies. */
  }
  return { status: response.status, data };
}

function check(name, response, expected, condition = true) {
  const passed = response.status === expected && condition;
  const entry = { prueba: name, esperado: expected, obtenido: response.status, aprobada: passed };
  results.push(entry);
  console.log(JSON.stringify(entry));
  if (!passed) throw new Error(`Prueba no aprobada: ${name}; HTTP ${response.status}.`);
  return response.data;
}

async function login(name, password) {
  const response = await request('POST', '/auth/login', null, { username: name, password });
  if (response.status !== 200 || typeof response.data?.token !== 'string')
    throw new Error('No se pudo preparar la sesión requerida.');
  return response.data;
}

async function cleanup() {
  if (!adminToken) return;
  for (const id of owned.users) {
    const account = await request('GET', `/usuarios/${id}`, adminToken);
    if (!account.data?.userName.startsWith(username))
      throw new Error('La limpieza encontró un usuario ajeno.');
    if (account.data.activo)
      check(
        `Limpieza: desactivar usuario ${id}`,
        await request('PUT', `/usuarios/${id}/desactivar`, adminToken, {}),
        200,
      );
  }
  const areas = await request('GET', '/areas', adminToken);
  for (const id of owned.areas) {
    const area = areas.data.find((item) => item.areaId === id);
    if (!area?.nombre.startsWith(run)) throw new Error('La limpieza encontró un área ajena.');
    if (area.activo)
      check(
        `Limpieza: desactivar área ${id}`,
        await request('PATCH', `/areas/${id}/desactivar`, adminToken, {}),
        200,
      );
  }
}

if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Esperando credencial por stdin (sin eco ni persistencia).');
let credential = '';
for await (const chunk of process.stdin) {
  credential += chunk.toString();
  if (/[\r\n]/.test(credential)) break;
}
if (process.stdin.isTTY) process.stdin.setRawMode(false);
credential = credential.replace(/[\r\n]+$/, '');
try {
  if (!credential) throw new Error('No se recibió credencial; no se enviará login.');
  verifyDatabase();
  adminToken = (await login('admin', credential)).token;
  credential = '';
  console.log(JSON.stringify({ ejecucion: run, baseVerificada: 'ControlFinancieroDB_Pruebas' }));
  if (cleanupRun) {
    const users = await request('GET', '/usuarios', adminToken);
    const areas = await request('GET', '/areas', adminToken);
    owned.users.push(
      ...users.data.filter((item) => item.userName.startsWith(username)).map((item) => item.id),
    );
    owned.areas.push(
      ...areas.data.filter((item) => item.nombre.startsWith(run)).map((item) => item.areaId),
    );
  } else {
    const a = check(
      'Crear área A',
      await request('POST', '/areas', adminToken, { nombre: `${run}_A` }),
      201,
    );
    owned.areas.push(a.areaId);
    const b = check(
      'Crear área B',
      await request('POST', '/areas', adminToken, { nombre: `${run}_B` }),
      201,
    );
    owned.areas.push(b.areaId);
    check(
      'Rechazar área duplicada',
      await request('POST', '/areas', adminToken, { nombre: `${run}_A` }),
      409,
    );
    check(
      'Rechazar nombre de área vacío',
      await request('PUT', `/areas/${a.areaId}`, adminToken, { nombre: ' ' }),
      400,
    );
    check(
      'Rechazar nombre de área mayor de 100',
      await request('POST', '/areas', adminToken, { nombre: run + 'x'.repeat(101) }),
      400,
    );
    check(
      'Modificar área A',
      await request('PUT', `/areas/${a.areaId}`, adminToken, { nombre: `${run}_A_EDITADA` }),
      200,
    );
    const list = await request('GET', '/areas', adminToken);
    check(
      'Persistencia de modificación de área',
      list,
      200,
      list.data.some((item) => item.areaId === a.areaId && item.nombre === `${run}_A_EDITADA`),
    );
    check(
      'Desactivar área',
      await request('PATCH', `/areas/${a.areaId}/desactivar`, adminToken, {}),
      200,
    );
    check(
      'Rechazar desactivación repetida de área',
      await request('PATCH', `/areas/${a.areaId}/desactivar`, adminToken, {}),
      409,
    );
    const userBody = {
      nombreUsuario: `${username}.miembro`,
      nombreCompleto: `${run} Miembro`,
      passwordInicial: passwords[0],
      areaId: a.areaId,
      roles: ['PersonalArea'],
    };
    check(
      'Rechazar alta en área inactiva',
      await request('POST', '/usuarios', adminToken, userBody),
      400,
    );
    check(
      'Activar área',
      await request('PATCH', `/areas/${a.areaId}/activar`, adminToken, {}),
      200,
    );
    const user = check(
      'Crear usuario',
      await request('POST', '/usuarios', adminToken, userBody),
      201,
    );
    const uid = user.usuario.id;
    owned.users.push(uid);
    check(
      'Rechazar usuario duplicado',
      await request('POST', '/usuarios', adminToken, userBody),
      409,
    );
    check(
      'Rechazar roles vacíos en alta',
      await request('POST', '/usuarios', adminToken, {
        ...userBody,
        nombreUsuario: `${username}.sinroles`,
        roles: [],
      }),
      400,
    );
    check(
      'Rechazar Auditor sin área',
      await request('POST', '/usuarios', adminToken, {
        ...userBody,
        nombreUsuario: `${username}.sinarea`,
        roles: ['Auditor'],
        areaId: null,
      }),
      400,
    );
    const firstLogin = await login(userBody.nombreUsuario, passwords[0]);
    check(
      'Usuario nuevo exige cambio de contraseña',
      { status: 200 },
      200,
      firstLogin.debeCambiarPassword === true,
    );
    check(
      'Middleware bloquea antes del cambio',
      await request('GET', '/areas', firstLogin.token),
      403,
    );
    check(
      'Cambiar contraseña del usuario de prueba',
      await request('POST', '/auth/cambiar-password', firstLogin.token, {
        passwordActual: passwords[0],
        passwordNueva: passwords[1],
      }),
      200,
    );
    check(
      'Token previo al cambio queda inválido',
      await request('GET', '/areas', firstLogin.token),
      401,
    );
    let memberToken = (await login(userBody.nombreUsuario, passwords[1])).token;
    check(
      'Modificar identidad y área del usuario',
      await request('PUT', `/usuarios/${uid}`, adminToken, {
        nombreUsuario: `${username}.editado`,
        nombreCompleto: `${run} Modificado`,
        areaId: b.areaId,
      }),
      200,
    );
    check(
      'Cambio de datos de acceso invalida token',
      await request('GET', '/areas', memberToken),
      401,
    );
    const saved = await request('GET', `/usuarios/${uid}`, adminToken);
    check(
      'Persistencia de identidad y área',
      saved,
      200,
      saved.data.userName === `${username}.editado` && saved.data.areaId === b.areaId,
    );
    const roleNames = ['Administrador', 'PersonalArea', 'JefeArea', 'Auditor'];
    for (let mask = 1; mask < 16; mask++) {
      const roles = roleNames.filter((_, bit) => mask & (1 << bit));
      check(
        `Asignación ${roles.join('+')}`,
        await request('PUT', `/usuarios/${uid}/roles`, adminToken, { roles }),
        200,
      );
      const identity = await login(`${username}.editado`, passwords[1]);
      memberToken = identity.token;
      check(
        `Claims ${roles.join('+')}`,
        { status: 200 },
        200,
        roles.length === identity.roles.length &&
          roles.every((role) => identity.roles.includes(role)),
      );
      check(`Consulta áreas ${roles.join('+')}`, await request('GET', '/areas', memberToken), 200);
      check(
        `Consulta usuarios ${roles.join('+')}`,
        await request('GET', '/usuarios', memberToken),
        roles.includes('Administrador') ? 200 : 403,
      );
      check(
        `Edición área ${roles.join('+')}`,
        await request('PUT', `/areas/${b.areaId}`, memberToken, { nombre: `${run}_B` }),
        roles.includes('Administrador') ? 200 : 403,
      );
    }
    check(
      'Rechazar asignación sin roles',
      await request('PUT', `/usuarios/${uid}/roles`, adminToken, { roles: [] }),
      400,
    );
    check(
      'Rechazar rol inexistente',
      await request('PUT', `/usuarios/${uid}/roles`, adminToken, { roles: ['NoExiste'] }),
      400,
    );
    check(
      'Desactivar usuario de prueba',
      await request('PUT', `/usuarios/${uid}/desactivar`, adminToken, {}),
      200,
    );
    check(
      'Token de usuario desactivado rechazado',
      await request('GET', '/areas', memberToken),
      401,
    );
    check(
      'Login de usuario inactivo rechazado',
      await request('POST', '/auth/login', null, {
        username: `${username}.editado`,
        password: passwords[1],
      }),
      401,
    );
    check(
      'Rechazar desactivación repetida de usuario',
      await request('PUT', `/usuarios/${uid}/desactivar`, adminToken, {}),
      409,
    );
    check(
      'Rechazar reset de usuario inactivo',
      await request('PUT', `/usuarios/${uid}/restablecer-password`, adminToken, {
        passwordNueva: passwords[2],
      }),
      409,
    );
    check(
      'Desactivar área del usuario inactivo',
      await request('PATCH', `/areas/${b.areaId}/desactivar`, adminToken, {}),
      200,
    );
    check(
      'Rechazar activación de usuario con área inactiva',
      await request('PUT', `/usuarios/${uid}/activar`, adminToken, {}),
      409,
    );
    check(
      'Reactivar área del usuario',
      await request('PATCH', `/areas/${b.areaId}/activar`, adminToken, {}),
      200,
    );
    check(
      'Activar usuario de prueba',
      await request('PUT', `/usuarios/${uid}/activar`, adminToken, {}),
      200,
    );
    memberToken = (await login(`${username}.editado`, passwords[1])).token;
    check(
      'Restablecimiento administrativo',
      await request('PUT', `/usuarios/${uid}/restablecer-password`, adminToken, {
        passwordNueva: passwords[2],
      }),
      200,
    );
    check(
      'Restablecimiento invalida token anterior',
      await request('GET', '/areas', memberToken),
      401,
    );
    const resetLogin = await login(`${username}.editado`, passwords[2]);
    check(
      'Reset exige cambio obligatorio',
      await request('GET', '/areas', resetLogin.token),
      403,
      resetLogin.debeCambiarPassword === true,
    );
    check(
      'Completar cambio tras reset',
      await request('POST', '/auth/cambiar-password', resetLogin.token, {
        passwordActual: passwords[2],
        passwordNueva: passwords[3],
      }),
      200,
    );
    const exclusive = check(
      'Administrador exclusivo sin área',
      await request('POST', '/usuarios', adminToken, {
        ...userBody,
        nombreUsuario: `${username}.adminsolo`,
        areaId: null,
        roles: ['Administrador'],
      }),
      201,
    );
    const aid = exclusive.usuario.id;
    owned.users.push(aid);
    check(
      'Roles combinados requieren área previa',
      await request('PUT', `/usuarios/${aid}/roles`, adminToken, {
        roles: ['Administrador', 'Auditor'],
      }),
      400,
    );
    check(
      'Asignar área al administrador de prueba',
      await request('PUT', `/usuarios/${aid}`, adminToken, {
        nombreUsuario: `${username}.adminsolo`,
        nombreCompleto: `${run} Admin de prueba`,
        areaId: a.areaId,
      }),
      200,
    );
    check(
      'Asignar múltiples roles con área',
      await request('PUT', `/usuarios/${aid}/roles`, adminToken, {
        roles: ['Administrador', 'Auditor'],
      }),
      200,
    );
  }
} catch (error) {
  credential = '';
  console.log(
    JSON.stringify({ error: error instanceof Error ? error.message : 'Error de integración' }),
  );
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    verifyDatabase();
  } catch {
    console.log('No se pudo completar la limpieza segura; revisar IDs creados.');
    process.exitCode = 1;
  }
  console.log(
    JSON.stringify({
      ejecucion: run,
      registros: owned,
      pruebas: results.length,
      aprobadas: results.filter((item) => item.aprobada).length,
      estadoFinal: 'Registros propios desactivados si la limpieza terminó correctamente',
    }),
  );
  adminToken = undefined;
  passwords.fill('');
}
