import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';

/** The API returns UTC events; EF may omit the timezone suffix on persisted DateTime values. */
export function peruTimestamp(value: string): string {
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : value + 'Z';
  return Number.isFinite(new Date(normalized).getTime())
    ? formatDate(normalized, 'dd/MM/yyyy HH:mm:ss', 'en-US', '-0500')
    : 'Fecha no disponible';
}
@Pipe({ name: 'peruTimestamp' })
export class PeruTimestamp implements PipeTransform {
  transform(value: string): string {
    return peruTimestamp(value);
  }
}
