import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DetectionPage } from './detection-page';
import { AccessPolicy } from '../../../core/auth/access-policy';
describe('Detection UI (simulated HTTP)', () => {
  const can = vi.fn(() => true);
  beforeEach(() => {
    can.mockReturnValue(true);
    TestBed.configureTestingModule({
      imports: [DetectionPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AccessPolicy, useValue: { can } },
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  async function setup() {
    const fixture = TestBed.createComponent(DetectionPage);
    await fixture.whenStable();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      http: TestBed.inject(HttpTestingController),
    };
  }
  it('never runs on entry or fetches a nonexistent rule catalog; documents the actual rule logic', async () => {
    const { el, http } = await setup();
    http.expectNone(() => true);
    expect(el.textContent).toContain('misma cuenta');
    expect(el.textContent).toContain('Contraseña incorrecta.');
    expect(el.textContent).toContain('inteligencia artificial');
    expect(el.textContent).toContain('La API no expone un catálogo');
    expect(el.querySelectorAll('input,select,textarea,a[href^="/alertas"]')).toHaveLength(0);
  });
  it('sends one request on repeated clicks and distinguishes zero new alerts from absence of anomalies', async () => {
    const { fixture, el, http } = await setup();
    const button = el.querySelector<HTMLButtonElement>('button')!;
    button.click();
    button.click();
    await fixture.whenStable();
    expect(button.disabled).toBe(true);
    expect(el.textContent).toContain('Evaluando reglas');
    http.expectOne('/api/anomalias/detectar').flush({ mensaje: 'Finalizada', nuevasAlertas: 0 });
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
    expect(el.textContent).toContain('no confirma la ausencia de anomalías');
  });
  it('displays positive results and the server message as text without alert management controls', async () => {
    const { fixture, el, http } = await setup();
    el.querySelector<HTMLButtonElement>('button')!.click();
    http
      .expectOne('/api/anomalias/detectar')
      .flush({ mensaje: '<img src=x onerror=alert(1)>', nuevasAlertas: 3 });
    await fixture.whenStable();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('posterior seguimiento');
    expect(el.querySelectorAll('button')).toHaveLength(1);
  });
  it('removes stale success after a denied execution and allows an explicit retry without auto retry', async () => {
    const { fixture, el, http } = await setup();
    const button = el.querySelector<HTMLButtonElement>('button')!;
    button.click();
    http
      .expectOne('/api/anomalias/detectar')
      .flush({ mensaje: 'Éxito anterior', nuevasAlertas: 1 });
    await fixture.whenStable();
    button.click();
    http
      .expectOne('/api/anomalias/detectar')
      .flush({ mensaje: 'Acceso denegado' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Acceso denegado');
    expect(el.textContent).not.toContain('Éxito anterior');
    expect(el.querySelector('app-detection-result')).toBeNull();
    http.expectNone(() => true);
    expect(button.disabled).toBe(false);
  });
  it('does not claim rollback on a network failure or silently reissue the operation', async () => {
    const { fixture, el, http } = await setup();
    el.querySelector<HTMLButtonElement>('button')!.click();
    http.expectOne('/api/anomalias/detectar').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(el.textContent).toContain('podría haberse completado');
    expect(el.textContent).toContain('No se reintenta automáticamente');
    http.expectNone(() => true);
  });
  it('disables execution and refuses even a direct click without the specific permission', async () => {
    can.mockReturnValue(false);
    const { el, http } = await setup();
    expect(el.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    el.querySelector<HTMLButtonElement>('button')!.click();
    http.expectNone(() => true);
  });
});
