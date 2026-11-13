// Real, directed O1/O5/O8 validation. No credentials or JWT are persisted or printed.
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyTestDatabase, hiddenLines } from './testing/test-environment.mjs';

if (process.argv.includes('--verify')) {
  verifyTestDatabase();
  console.log('API efectiva exclusiva: ControlFinancieroDB_Pruebas');
  process.exit(0);
}
const input = hiddenLines();
const run = `QA_B2_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
const owned = { area: null, users: [] };
let adminSecret, qaSecret, admin, sessionToken, expiryTimer;
let sessionId,
  sessionSnapshot,
  expiryFinished = false;
function assert(value, message) {
  if (!value) throw new Error(message);
  console.log(`APROBADO: ${message}`);
}
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
async function request(method, path, token, body) {
  verifyTestDatabase();
  if (method !== 'GET' && !path.startsWith('/auth/')) {
    if (path === '/areas' && !body.nombre.startsWith(run)) throw new Error('Área ajena.');
    if (
      path === '/usuarios' &&
      (!body.nombreUsuario.startsWith(run.toLowerCase()) || body.areaId !== owned.area)
    )
      throw new Error('Cuenta ajena.');
    const match = path.match(/^\/(usuarios|areas)\/(\d+)\/(desactivar)$/);
    if (
      path !== '/areas' &&
      path !== '/usuarios' &&
      (!match || !(match[1] === 'areas' ? [owned.area] : owned.users).includes(Number(match[2])))
    )
      throw new Error('Escritura no autorizada por este arnés.');
    if (match?.[1] === 'usuarios' && Number(match[2]) === sessionId && !expiryFinished)
      throw new Error('No modificar actor O1 durante la espera.');
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
    /* No response body is logged. */
  }
  return { status: response.status, data };
}
async function login(username, password) {
  const response = await request('POST', '/auth/login', null, { username, password });
  if (response.status !== 200 || !response.data?.token)
    throw new Error('No se pudo preparar sesión QA.');
  return response.data;
}
async function user(suffix, roles) {
  const username = `${run.toLowerCase()}.${suffix}`;
  const initial = `Aa1!${randomUUID()}`;
  const response = await request('POST', '/usuarios', admin, {
    nombreUsuario: username,
    nombreCompleto: `${run} ${suffix}`,
    passwordInicial: initial,
    areaId: owned.area,
    roles,
  });
  if (response.status !== 201) throw new Error('No se pudo preparar cuenta QA.');
  const id = response.data.usuario.id;
  owned.users.push(id);
  const first = await login(username, initial);
  const changed = await request('POST', '/auth/cambiar-password', first.token, {
    passwordActual: initial,
    passwordNueva: qaSecret,
  });
  if (changed.status !== 200) throw new Error('No se pudo preparar credencial QA.');
  return { id, username };
}
function securitySnapshot() {
  // SecurityStamp is compared only in memory; no secret-bearing field is output.
  return sql(
    `SELECT Activo,AreaId,DebeCambiarPassword,SecurityStamp,(SELECT r.Name FROM AspNetUserRoles ur JOIN AspNetRoles r ON r.Id=ur.RoleId WHERE ur.UserId=u.Id ORDER BY r.Name FOR JSON PATH) Roles FROM AspNetUsers u WHERE Id=${sessionId} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER;`,
  );
}
try {
  console.log('Dos líneas ocultas por stdin: credencial admin y credencial QA de preparación.');
  adminSecret = await input.read();
  qaSecret = await input.read();
  admin = (await login('admin', adminSecret)).token;
  const area = await request('POST', '/areas', admin, { nombre: `${run}_A` });
  if (area.status !== 201) throw new Error('No se pudo preparar área QA.');
  owned.area = area.data.areaId;
  const session = await user('sesion', ['PersonalArea']);
  sessionId = session.id;
  const importer = await user('importacion', ['PersonalArea']);
  const auditor = await user('auditor', ['Auditor']);
  const issuedAt = Date.now();
  const auth = await login(session.username, qaSecret);
  sessionToken = auth.token;
  const claims = JSON.parse(Buffer.from(sessionToken.split('.')[1], 'base64url').toString());
  const expires = claims.exp * 1000;
  assert(Number.isFinite(expires) && expires > Date.now(), 'O1 JWT con exp real futuro');
  const before = await request('GET', '/registros-financieros', sessionToken);
  assert(before.status === 200, 'O1 petición protegida válida antes del exp');
  sessionSnapshot = securitySnapshot();
  console.log(
    JSON.stringify({
      run,
      areaId: owned.area,
      session,
      importer,
      auditor,
      apiLoginStartedUTC: new Date(issuedAt).toISOString(),
      apiExpUTC: new Date(expires).toISOString(),
      apiExpPeru: new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(expires),
      remainingSeconds: Math.floor((expires - Date.now()) / 1000),
    }),
  );
  expiryTimer = setTimeout(
    async () => {
      try {
        const after = await request('GET', '/registros-financieros', sessionToken);
        assert(after.status === 401, 'O1 API rechaza JWT naturalmente vencido con HTTP 401');
        assert(
          securitySnapshot() === sessionSnapshot,
          'O1 estado, contraseña (SecurityStamp), roles y área sin cambios durante la espera',
        );
        expiryFinished = true;
        console.log(
          JSON.stringify({
            O1_API: 'aprobada',
            checkedUTC: new Date().toISOString(),
            expUTC: new Date(expires).toISOString(),
          }),
        );
      } catch (error) {
        console.log(`O1 API PENDIENTE/FALLO: ${error.message}`);
      }
    },
    Math.max(0, expires - Date.now() + 1500),
  );
  console.log(
    'Comandos ocultos: inventory (QA pendientes), evidence (persistencia O5/O8), finish (solo después de O1 navegador).',
  );
  for (;;) {
    const command = await input.read();
    if (command === 'inventory') {
      console.log(
        sql(
          "SELECT a.UsuarioId,a.AreaId,a.ReglaAnomaliaId,r.Codigo,COUNT(*) Pendientes,MIN(a.AlertaId) PrimerId,MAX(a.AlertaId) UltimoId FROM Alertas a JOIN AspNetUsers u ON u.Id=a.UsuarioId JOIN ReglasAnomalia r ON r.ReglaAnomaliaId=a.ReglaAnomaliaId WHERE a.Estado='Pendiente' AND u.UserName LIKE 'qa[_]%' GROUP BY a.UsuarioId,a.AreaId,a.ReglaAnomaliaId,r.Codigo ORDER BY Pendientes DESC FOR JSON PATH;",
        ),
      );
    } else if (command === 'evidence') {
      console.log(
        sql(
          `SELECT d.DocumentoFinancieroId,d.NombreArchivo,(SELECT COUNT(*) FROM RegistrosFinancieros r WHERE r.DocumentoFinancieroId=d.DocumentoFinancieroId) Registros FROM DocumentosFinancieros d WHERE d.UsuarioId=${importer.id} FOR JSON PATH;`,
        ),
      );
      console.log(
        sql(
          `SELECT COUNT(*) Registros,COUNT(DISTINCT Descripcion) Descripciones,MIN(Descripcion) Primera,MAX(Descripcion) Ultima,SUM(Monto) Monto FROM RegistrosFinancieros WHERE UsuarioId=${importer.id} FOR JSON PATH;`,
        ),
      );
      console.log(
        sql(
          `SELECT BitacoraActividadId,TipoActividad,Resultado,CONVERT(varchar(40),FechaHora,126) FechaUTC,Detalle FROM BitacorasActividades WHERE UsuarioId=${auditor.id} AND TipoActividad='InicioRevisionAlerta' FOR JSON PATH;`,
        ),
      );
    } else if (command === 'finish') {
      if (!expiryFinished)
        throw new Error('O1 no terminó; limpieza bloqueada para no invalidar su resultado.');
      assert(
        securitySnapshot() === sessionSnapshot,
        'O1 invariante conservado hasta finalizar navegador',
      );
      break;
    }
  }
} catch (error) {
  console.log(`VALIDACIÓN INTERRUMPIDA: ${error.message}`);
  process.exitCode = 1;
} finally {
  clearTimeout(expiryTimer);
  if (owned.area && (!sessionToken || expiryFinished)) {
    try {
      admin = (await login('admin', adminSecret)).token;
      for (const id of owned.users) {
        const current = await request('GET', `/usuarios/${id}`, admin);
        if (!current.data?.userName?.startsWith(run.toLowerCase()))
          throw new Error('Limpieza ajena bloqueada.');
        if (current.data.activo)
          assert(
            (await request('PUT', `/usuarios/${id}/desactivar`, admin, {})).status === 200,
            `Limpieza QA usuario ${id}`,
          );
      }
      assert(
        (await request('PATCH', `/areas/${owned.area}/desactivar`, admin, {})).status === 200,
        `Limpieza QA área ${owned.area}`,
      );
    } catch (error) {
      console.log(`LIMPIEZA PENDIENTE: ${error.message}`);
      process.exitCode = 1;
    }
  } else if (owned.area)
    console.log(
      'Fixtures activos conservados: O1 pendiente, no invalidar antes de comprobar expiración.',
    );
  adminSecret = '';
  qaSecret = '';
  admin = null;
  sessionToken = null;
  input.close();
}
