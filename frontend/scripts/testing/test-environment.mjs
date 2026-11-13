import { execFileSync } from 'node:child_process';
export function verifyTestDatabase() {
  const pid = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      '(Get-NetTCPConnection -State Listen -LocalPort 7202 | Select-Object -ExpandProperty OwningProcess -Unique)',
    ],
    { encoding: 'utf8', windowsHide: true },
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
    { encoding: 'utf8', windowsHide: true },
  )
    .trim()
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (databases.length !== 1 || databases[0] !== 'ControlFinancieroDB_Pruebas')
    throw new Error(
      'Se bloqueó la prueba: la API no está exclusivamente en ControlFinancieroDB_Pruebas.',
    );
}
export function hiddenLines() {
  const lines = [];
  const waiting = [];
  let buffer = '';
  if (!process.stdin.isTTY)
    throw new Error('Ejecute con terminal interactiva para recibir credenciales sin eco.');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  const receive = (chunk) => {
    buffer += chunk.toString();
    let match;
    while ((match = buffer.match(/[\r\n]/))) {
      const line = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + 1);
      const resolve = waiting.shift();
      if (resolve) resolve(line);
      else lines.push(line);
    }
  };
  process.stdin.on('data', receive);
  return {
    read: () =>
      lines.length
        ? Promise.resolve(lines.shift())
        : new Promise((resolve) => waiting.push(resolve)),
    close: () => {
      process.stdin.off('data', receive);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      buffer = '';
      lines.fill('');
    },
  };
}
