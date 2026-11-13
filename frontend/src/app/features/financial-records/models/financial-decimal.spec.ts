import { describe, it, expect } from 'vitest';
import { FormControl } from '@angular/forms';
import { normalizeAmount, operationDateValidator, parseFinancialJson } from './financial-decimal';
import { encodeRecord } from '../data-access/record-codec';

describe('Exact financial decimal handling', () => {
  it('preserves the backend maximum including cents on read and write', () => {
    expect(parseFinancialJson('{"monto":9999999999999999.99}')).toEqual({
      monto: '9999999999999999.99',
    });
    expect(
      encodeRecord({
        tipoOperacion: 'Ingreso',
        descripcion: 'Prueba',
        fechaOperacion: '2026-11-11',
        monto: '9999999999999999.99',
      }),
    ).toContain('"monto":9999999999999999.99');
  });
  it('normalizes comma and leading zeros without floating point', () => {
    expect(normalizeAmount('00012,3')).toBe('12.30');
    expect(normalizeAmount('0.01')).toBe('0.01');
  });
  it.each(['0', '-1', '1e3', '1.005', '1,234.00', '10000000000000000', 'NaN', '1,"areaId":9'])(
    'rejects invalid or unsafe input %s',
    (value) => expect(normalizeAmount(value)).toBeNull(),
  );
  it('serializes rowVersion and escapes descriptive text without changing the amount token', () => {
    const json = encodeRecord(
      {
        tipoOperacion: 'Egreso',
        descripcion: 'Texto "monto":100 y <script>',
        fechaOperacion: '2026-11-11',
        monto: '0.29',
      },
      'AAAAAAAAAAE=',
    );
    expect(JSON.parse(json)).toMatchObject({
      descripcion: 'Texto "monto":100 y <script>',
      rowVersion: 'AAAAAAAAAAE=',
    });
    expect(json).toContain('"monto":0.29');
  });
  it('validates actual calendar dates and leap years', () => {
    expect(operationDateValidator(new FormControl('2024-02-29'))).toBeNull();
    expect(operationDateValidator(new FormControl('2026-02-29'))).not.toBeNull();
    expect(operationDateValidator(new FormControl('0000-01-01'))).not.toBeNull();
  });
});
