import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { AlertsPage } from './alerts-page';
import { Session } from '../../../core/auth/session';
import { alertFixture, alertPage } from '../testing/alert-fixture';
describe('Alert lifecycle UI (simulated HTTP)', () => {
  const originalDialog = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
  beforeEach(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.setAttribute('open', '');
      }),
    });
    TestBed.configureTestingModule({
      imports: [AlertsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Session,
          useValue: { identity: signal({ roles: ['Auditor'], mustChangePassword: false }) },
        },
      ],
    });
  });
  afterEach(() => {
    try {
      TestBed.inject(HttpTestingController).verify();
    } finally {
      TestBed.resetTestingModule();
      vi.restoreAllMocks();
      if (originalDialog)
        Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalDialog);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    }
  });
  async function setup(state: 'Pendiente' | 'En revision' | 'Resuelta' = 'Pendiente') {
    const fixture = TestBed.createComponent(AlertsPage),
      http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === '/api/alertas').flush(alertPage());
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[aria-label="Ver alerta 7"]')!.click();
    http.expectOne('/api/alertas/7').flush(alertFixture({ estado: state }));
    await fixture.whenStable();
    return { fixture, http, el };
  }
  function click(el: HTMLElement, text: string) {
    const button = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === text,
    );
    if (!button) throw new Error('Missing button ' + text);
    button.click();
  }
  it('confirms review and refreshes detail and the current list after success', async () => {
    const s = await setup();
    click(s.el, 'Iniciar revisión');
    await s.fixture.whenStable();
    s.http.expectNone((r) => r.method === 'POST');
    click(s.el, 'Confirmar');
    click(s.el, 'Confirmar');
    const req = s.http.expectOne('/api/alertas/7/iniciar-revision');
    expect(req.request.body.rowVersion).toBe('AAAAAAAAAAE=');
    req.flush({ mensaje: 'Revisión iniciada correctamente.' });
    s.http
      .expectOne('/api/alertas/7')
      .flush(alertFixture({ estado: 'En revision', rowVersion: 'AAAAAAAAAAI=' }));
    s.http.expectOne((r) => r.url === '/api/alertas').flush(alertPage({ alertas: [] }));
    await s.fixture.whenStable();
    expect(s.el.textContent).toContain('Revisión iniciada correctamente.');
    expect(s.el.querySelector('#alert-justification')).not.toBeNull();
  });
  it('keeps justification after a real-shaped 409, refreshes RowVersion and requires another confirmation', async () => {
    const s = await setup('En revision');
    const field = s.el.querySelector<HTMLTextAreaElement>('#alert-justification')!;
    field.value = '  Cierre documentado de prueba  ';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    s.el
      .querySelector('app-alert-actions form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await s.fixture.whenStable();
    expect(s.el.querySelector('dialog')?.textContent).toContain('Cierre documentado de prueba');
    click(s.el, 'Confirmar');
    const req = s.http.expectOne('/api/alertas/7/cerrar');
    expect(req.request.body.justificacion).toBe('Cierre documentado de prueba');
    req.flush(
      { mensaje: 'La alerta fue modificada. Consulte nuevamente.' },
      { status: 409, statusText: 'Conflict' },
    );
    s.http
      .expectOne('/api/alertas/7')
      .flush(alertFixture({ estado: 'En revision', rowVersion: 'AAAAAAAAAAM=' }));
    s.http.expectOne((r) => r.url === '/api/alertas').flush(alertPage());
    await s.fixture.whenStable();
    expect(field.value).toContain('Cierre documentado');
    expect(s.el.textContent).toContain('No se reenvió la operación');
    expect(s.el.querySelector('dialog')).toBeNull();
    s.http.expectNone((r) => r.method === 'POST');
    s.el
      .querySelector('app-alert-actions form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await s.fixture.whenStable();
    expect(s.el.querySelector('dialog')?.textContent).not.toContain('La alerta fue modificada.');
    click(s.el, 'Confirmar');
    const retry = s.http.expectOne('/api/alertas/7/cerrar');
    expect(retry.request.body.rowVersion).toBe('AAAAAAAAAAM=');
    retry.flush({ mensaje: 'Cerrada' });
    s.http.expectOne('/api/alertas/7').flush(
      alertFixture({
        estado: 'Resuelta',
        rowVersion: 'AAAAAAAAAAQ=',
        justificacionCierre: 'Cierre documentado de prueba',
      }),
    );
    s.http.expectOne((r) => r.url === '/api/alertas').flush(alertPage());
    await s.fixture.whenStable();
    expect(s.el.querySelector('#alert-justification')).toBeNull();
  });
  it('keeps uncertain writes blocked until a successful manual refresh clears the obsolete warning', async () => {
    const s = await setup('En revision');
    const field = s.el.querySelector<HTMLTextAreaElement>('#alert-justification')!;
    field.value = 'Cierre QA con respuesta perdida';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    s.el
      .querySelector('app-alert-actions form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await s.fixture.whenStable();
    click(s.el, 'Confirmar');
    s.http.expectOne('/api/alertas/7/cerrar').error(new ProgressEvent('error'));
    s.http.expectOne('/api/alertas/7').error(new ProgressEvent('error'));
    s.http.expectOne((r) => r.url === '/api/alertas').error(new ProgressEvent('error'));
    await s.fixture.whenStable();
    expect(s.el.textContent).toContain('No se pudo confirmar el cambio');
    expect(
      [...s.el.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.trim() === 'Confirmar cierre…')!
        .matches(':disabled'),
    ).toBe(true);
    click(s.el, 'Actualizar detalle');
    s.http.expectOne('/api/alertas/7').error(new ProgressEvent('error'));
    await s.fixture.whenStable();
    expect(s.el.textContent).toContain('No se pudo confirmar el cambio');
    click(s.el, 'Actualizar detalle');
    s.http.expectOne('/api/alertas/7').flush(
      alertFixture({
        estado: 'Resuelta',
        rowVersion: 'AAAAAAAAAAI=',
        justificacionCierre: 'Cierre QA con respuesta perdida',
      }),
    );
    await s.fixture.whenStable();
    expect(s.el.querySelector('#alert-detail')!.textContent).not.toContain(
      'No se pudo confirmar el cambio',
    );
    expect(s.el.querySelector('app-alert-actions form')).toBeNull();
    expect(s.el.textContent).toContain('No hay una transición de reapertura');
    s.http.expectNone((r) => r.method === 'POST');
  });
  it('blocks short justifications and exposes no reopening for a closed alert', async () => {
    const s = await setup('En revision');
    s.el
      .querySelector('app-alert-actions form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await s.fixture.whenStable();
    s.http.expectNone((r) => r.method === 'POST');
    expect(s.el.textContent).toContain('entre 10 y 1000');
    click(s.el, 'Actualizar detalle');
    s.http.expectOne('/api/alertas/7').flush(alertFixture({ estado: 'Descartada' }));
    await s.fixture.whenStable();
    expect(s.el.querySelector('app-alert-actions form')).toBeNull();
    expect(s.el.textContent).toContain('No hay una transición de reapertura');
  });
  it('keeps writes blocked when conflict refresh fails', async () => {
    const s = await setup();
    click(s.el, 'Iniciar revisión');
    await s.fixture.whenStable();
    click(s.el, 'Confirmar');
    s.http
      .expectOne('/api/alertas/7/iniciar-revision')
      .flush({ mensaje: 'Conflicto' }, { status: 409, statusText: 'Conflict' });
    s.http.expectOne('/api/alertas/7').flush({}, { status: 503, statusText: 'Unavailable' });
    s.http.expectOne((r) => r.url === '/api/alertas').flush(alertPage());
    await s.fixture.whenStable();
    expect(
      [...s.el.querySelectorAll<HTMLButtonElement>('button')].find(
        (b) => b.textContent?.trim() === 'Iniciar revisión',
      )!.disabled,
    ).toBe(true);
  });
  it('clears protected detail when access disappears after refresh', async () => {
    const s = await setup();
    click(s.el, 'Actualizar detalle');
    s.http
      .expectOne('/api/alertas/7')
      .flush({ mensaje: 'No encontrada' }, { status: 404, statusText: 'Not Found' });
    s.http
      .expectOne((r) => r.url === '/api/alertas')
      .flush(alertPage({ totalRegistros: 0, totalPaginas: 0, alertas: [] }));
    await s.fixture.whenStable();
    expect(s.el.querySelector('app-alert-detail')).toBeNull();
    expect(s.el.textContent).toContain('No se encontraron alertas');
  });
  it('paginates in the server and resets page when applying supported filters', async () => {
    const fixture = TestBed.createComponent(AlertsPage),
      http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url === '/api/alertas')
      .flush(alertPage({ totalRegistros: 21, totalPaginas: 2 }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    click(el, 'Siguiente');
    http
      .expectOne((r) => r.params.get('pagina') === '2')
      .flush(alertPage({ pagina: 2, totalRegistros: 21, totalPaginas: 2 }));
    await fixture.whenStable();
    const select = el.querySelector<HTMLSelectElement>('#alert-state')!;
    select.value = 'En revision';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    el.querySelector('app-alert-filters form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    http
      .expectOne((r) => r.params.get('pagina') === '1' && r.params.get('estado') === 'En revision')
      .flush(alertPage({ alertas: [], totalRegistros: 0, totalPaginas: 0 }));
    await fixture.whenStable();
    expect(el.textContent).toContain('No se encontraron alertas');
  });
  it('returns to a valid page when reviewing the last pending alert removes the final page', async () => {
    const fixture = TestBed.createComponent(AlertsPage),
      http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url === '/api/alertas')
      .flush(alertPage({ totalRegistros: 21, totalPaginas: 2 }));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const state = el.querySelector<HTMLSelectElement>('#alert-state')!;
    state.value = 'Pendiente';
    state.dispatchEvent(new Event('change', { bubbles: true }));
    el.querySelector('app-alert-filters form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    http
      .expectOne((r) => r.url === '/api/alertas' && r.params.get('estado') === 'Pendiente')
      .flush(alertPage({ totalRegistros: 21, totalPaginas: 2 }));
    await fixture.whenStable();
    click(el, 'Siguiente');
    http
      .expectOne((r) => r.params.get('pagina') === '2')
      .flush(alertPage({ pagina: 2, totalRegistros: 21, totalPaginas: 2 }));
    await fixture.whenStable();
    el.querySelector<HTMLButtonElement>('[aria-label="Ver alerta 7"]')!.click();
    http.expectOne('/api/alertas/7').flush(alertFixture());
    await fixture.whenStable();
    click(el, 'Iniciar revisión');
    await fixture.whenStable();
    click(el, 'Confirmar');
    http.expectOne('/api/alertas/7/iniciar-revision').flush({ mensaje: 'Revisión iniciada' });
    http
      .expectOne('/api/alertas/7')
      .flush(alertFixture({ estado: 'En revision', rowVersion: 'AAAAAAAAAAI=' }));
    http
      .expectOne((r) => r.url === '/api/alertas' && r.params.get('pagina') === '2')
      .flush(alertPage({ pagina: 2, totalRegistros: 20, totalPaginas: 1, alertas: [] }));
    await fixture.whenStable();
    http
      .expectOne(
        (r) =>
          r.url === '/api/alertas' &&
          r.params.get('pagina') === '1' &&
          r.params.get('estado') === 'Pendiente',
      )
      .flush(alertPage({ totalRegistros: 20, totalPaginas: 1 }));
    await fixture.whenStable();
    expect(el.textContent).toContain('Página 1 de 1');
    expect(el.querySelector('#alert-justification')).not.toBeNull();
  });
});
