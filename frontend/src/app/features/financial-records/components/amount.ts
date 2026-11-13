import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'financialAmount' })
export class FinancialAmount implements PipeTransform {
  transform(amount: string): string {
    const [whole, fraction = '00'] = amount.split('.');
    return `${BigInt(whole).toLocaleString('es-PE')}.${fraction.padEnd(2, '0')}`;
  }
}
