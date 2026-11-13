import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';

/** EF DateTime can serialize UTC database values without a suffix. Both modules write UtcNow. */
export function utcTimestamp(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z';
  return Number.isFinite(new Date(normalized).getTime())
    ? formatDate(normalized, 'dd/MM/yyyy HH:mm:ss', 'en-US', 'UTC')
    : 'Fecha no disponible';
}
@Pipe({ name: 'utcTimestamp' })
export class UtcTimestamp implements PipeTransform {
  transform(value: string): string {
    return utcTimestamp(value);
  }
}
