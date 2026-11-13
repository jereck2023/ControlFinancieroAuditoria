import { AbstractControl, ValidatorFn } from '@angular/forms';

export function normalizeAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{1,16}(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.replace(',', '.').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents < 1n || cents > 999999999999999999n) return null;
  return `${BigInt(whole)}.${fraction.padEnd(2, '0')}`;
}

export const amountValidator: ValidatorFn = (control: AbstractControl) =>
  typeof control.value === 'string' && normalizeAmount(control.value) !== null
    ? null
    : { amount: true };

export const operationDateValidator: ValidatorFn = (control: AbstractControl) => {
  const value: unknown = control.value;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < '0001-01-01' ||
    value > '9999-12-31'
  )
    return { operationDate: true };
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? null
    : { operationDate: true };
};

/** Modern JSON.parse source context retains decimal lexemes before numeric rounding. */
export function parseFinancialJson(text: string): unknown {
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }) => {
    if (key !== 'monto' || typeof value !== 'number') return value;
    if (!context?.source)
      throw new Error('Actualice el navegador para consultar importes sin pérdida de precisión.');
    const amount = normalizeAmount(context.source);
    if (!amount)
      throw new Error('La API devolvió un importe fuera del formato financiero esperado.');
    return amount;
  });
}
