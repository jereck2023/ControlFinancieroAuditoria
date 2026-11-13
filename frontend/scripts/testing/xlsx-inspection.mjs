import { inflateRawSync } from 'node:zlib';
/** Inspect an API-produced ZIP entirely in memory; no workbook or credentials are saved. */
export function xlsxEntries(bytes) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('La exportación no es un ZIP válido.');
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) throw new Error('Directorio ZIP inválido.');
    const method = bytes.readUInt16LE(offset + 10),
      size = bytes.readUInt32LE(offset + 20),
      nameSize = bytes.readUInt16LE(offset + 28),
      extraSize = bytes.readUInt16LE(offset + 30),
      commentSize = bytes.readUInt16LE(offset + 32),
      local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameSize).toString('utf8');
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const packed = bytes.subarray(start, start + size);
    entries.set(name, (method === 8 ? inflateRawSync(packed) : packed).toString('utf8'));
    offset += 46 + nameSize + extraSize + commentSize;
  }
  return entries;
}
