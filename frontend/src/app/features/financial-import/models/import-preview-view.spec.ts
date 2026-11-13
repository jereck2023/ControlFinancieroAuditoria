import { describe, it, expect } from 'vitest';
import { validateImportFile } from './import-preview-view';
import { decodePreview } from '../data-access/import-api';
describe('Import file and preview handling', () => {
  it('accepts .xlsx case-insensitively and enforces size and filename limits', () => {
    expect(validateImportFile(new File(['data'], 'PRUEBA.XLSX'))).toBeNull();
    expect(validateImportFile(new File([], 'empty.xlsx'))).toContain('vacío');
    expect(validateImportFile(new File(['data'], 'test.xls'))).toContain('.xlsx');
    expect(
      validateImportFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.xlsx')),
    ).toContain('2 MB');
    expect(validateImportFile(new File(['data'], 'x'.repeat(256) + '.xlsx'))).toContain('255');
  });
  it('preserves preview error rows and exact decimal values', () => {
    const preview = decodePreview(
      '{"totalFilas":2,"registros":[{"numeroFila":2,"tipoOperacion":"Ingreso","descripcion":"Válida","fechaOperacion":"2026-11-11","monto":9999999999999999.99}],"errores":[{"numeroFila":3,"mensaje":"Monto inválido"}],"esValido":false,"hashArchivo":"hash"}',
    );
    expect(preview.registros[0].monto).toBe('9999999999999999.99');
    expect(preview.errores[0].numeroFila).toBe(3);
    expect(preview.esValido).toBe(false);
  });
});
