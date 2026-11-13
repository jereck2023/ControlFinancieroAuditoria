import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { AreasApi } from '../../areas/data-access/areas-api';
import { signal } from '@angular/core';
import { ReportFilters } from './report-filters';
import { Session } from '../../../core/auth/session';
import { ReportSelection } from '../models/requests/report-query';
describe('Report form behavior', () => {
  afterEach(() => TestBed.resetTestingModule());
  async function setup(auditor = true, failCatalog = false) {
    const catalog = [
      { areaId: 2, nombre: 'QA', activo: true },
      { areaId: 3, nombre: 'QA anterior', activo: false },
    ];
    const list = vi.fn().mockReturnValue(of(catalog));
    if (failCatalog)
      list.mockReturnValueOnce(throwError(() => new Error('Catálogo no disponible')));
    TestBed.configureTestingModule({
      imports: [ReportFilters],
      providers: [
        { provide: AreasApi, useValue: { list } },
        {
          provide: Session,
          useValue: {
            identity: signal({ roles: auditor ? ['Auditor'] : ['Administrador', 'JefeArea'] }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ReportFilters);
    const events: ReportSelection[] = [];
    fixture.componentInstance.apply.subscribe((event) => events.push(event));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = (id: string, value: string, event = 'input') => {
      const field = el.querySelector<HTMLInputElement>(id)!;
      field.value = value;
      field.dispatchEvent(new Event(event, { bubbles: true }));
    };
    const submit = () =>
      el
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    return { fixture, events, el, input, submit, list };
  }
  it('rejects missing dates, invalid calendar and reversed ranges without requests', async () => {
    const s = await setup();
    s.input('#report-from', '');
    s.submit();
    expect(s.events).toHaveLength(0);
    s.input('#report-from', '2026-11-12');
    s.input('#report-until', '2026-11-11');
    s.submit();
    await s.fixture.whenStable();
    expect(s.events).toHaveLength(0);
    expect(s.el.textContent).toContain('La fecha inicial no puede superar');
  });
  it('makes document modes exclusive, requires a specific ID and resets page', async () => {
    const s = await setup();
    s.input('#report-document-mode', 'specific', 'change');
    await s.fixture.whenStable();
    s.submit();
    expect(s.events).toHaveLength(0);
    s.input('#report-document', '9');
    s.submit();
    expect(s.events[0].query).toMatchObject({
      pagina: 1,
      documentoFinancieroId: 9,
      soloSinDocumento: false,
    });
    s.input('#report-document-mode', 'none', 'change');
    await s.fixture.whenStable();
    s.submit();
    expect(s.events[1].query.soloSinDocumento).toBe(true);
    expect(s.events[1].query).not.toHaveProperty('documentoFinancieroId');
  });
  it('does not expose another area to JefeArea even combined with Administrator', async () => {
    const s = await setup(false);
    expect(s.el.querySelector('#report-area')).toBeNull();
    expect(s.list).not.toHaveBeenCalled();
    s.submit();
    expect(s.events[0].query).not.toHaveProperty('areaId');
  });
  it('omits aggregation in detail and limits Auditor selection to real area IDs', async () => {
    const s = await setup();
    s.input('#report-area', '-1', 'change');
    s.submit();
    expect(s.events).toHaveLength(0);
    const select = s.el.querySelector<HTMLSelectElement>('#report-area')!;
    s.input(
      '#report-area',
      [...select.options].find((option) => option.textContent?.includes('ID 2'))!.value,
      'change',
    );
    s.input('#report-group', 'Area', 'change');
    s.input('#report-kind', 'detalle', 'change');
    await s.fixture.whenStable();
    s.submit();
    expect(s.events[0]).toMatchObject({
      kind: 'detalle',
      query: { areaId: 2, agrupacion: 'Ninguna' },
    });
    expect(s.el.querySelector('#report-group')).toBeNull();
  });
  it('shows catalog errors and retries without removing inactive areas from Auditor choices', async () => {
    const s = await setup(true, true);
    expect(s.el.textContent).toContain('Catálogo no disponible');
    [...s.el.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.trim() === 'Reintentar áreas')!
      .click();
    await s.fixture.whenStable();
    expect(s.list).toHaveBeenCalledTimes(2);
    expect(s.el.textContent).not.toContain('Catálogo no disponible');
    expect(s.el.textContent).toContain('QA anterior · ID 3 (inactiva)');
  });
});
