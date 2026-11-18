import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { AlertFilters } from './alert-filters';
import { Session } from '../../../core/auth/session';
import { AlertQuery } from '../models/requests/alert-requests';

describe('Filtros de Alertas en hora de Perú', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('convierte ambos límites a UTC incluyendo todo el segundo final', async () => {
    TestBed.configureTestingModule({
      imports: [AlertFilters],
      providers: [{ provide: Session, useValue: { identity: signal({ roles: ['Auditor'] }) } }],
    });
    const fixture = TestBed.createComponent(AlertFilters);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    let query: AlertQuery | undefined;
    fixture.componentInstance.apply.subscribe((v) => (query = v));
    for (const [id, value] of [
      ['alert-from', '2026-11-14T23:59:59'],
      ['alert-until', '2026-11-15T00:00'],
    ]) {
      const input = el.querySelector<HTMLInputElement>('#' + id)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(query?.fechaDesde).toBe('2026-11-15T04:59:59.0000000Z');
    expect(query?.fechaHasta).toBe('2026-11-15T05:00:00.9999999Z');
    expect(el.textContent).toContain('hora de Perú');
  });
});
