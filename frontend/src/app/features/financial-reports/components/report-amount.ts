import { Pipe, PipeTransform } from '@angular/core';
/** Text formatting only: never convert monetary decimals to floating point. */
@Pipe({ name: 'reportAmount' })
export class ReportAmount implements PipeTransform {
  transform(value: string): string {
    const [whole, fraction = '00'] = value.split('.');
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + fraction;
  }
}
