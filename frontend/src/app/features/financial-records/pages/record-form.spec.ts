import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { RecordForm } from './record-form';

describe('Record concurrency UI', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RecordForm],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: '8' }) } },
        },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  const record =
    '{"registroFinancieroId":8,"tipoOperacion":"Ingreso","descripcion":"Original","fechaOperacion":"2026-11-11","monto":12.34,"areaId":1,"nombreArea":"Prueba","usuarioId":2,"nombreUsuario":"Prueba","rowVersion":"AAAAAAAAAAE="}';
  it('blocks retry after a 409 until the current version is explicitly loaded', async () => {
    const fixture = TestBed.createComponent(RecordForm);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/registros-financieros/8').flush(record);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLTextAreaElement>('#description');
    if (!input) throw new Error('Missing description');
    input.value = 'Cambio de prueba';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const save = http.expectOne('/api/registros-financieros/8');
    expect(save.request.body).toContain('AAAAAAAAAAE=');
    save.flush(
      { mensaje: 'Otro usuario modificó el registro.' },
      { status: 409, statusText: 'Conflict' },
    );
    await fixture.whenStable();
    expect(element.textContent).toContain('El registro cambió mientras lo editaba');
    expect(element.querySelector('form')).toBeNull();
    expect(TestBed.inject(Router).navigate).not.toHaveBeenCalled();
    const reload = [...element.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.textContent?.includes('Cargar versión actual'),
    );
    reload?.click();
    http
      .expectOne('/api/registros-financieros/8')
      .flush(
        record.replace('AAAAAAAAAAE=', 'AAAAAAAAAAI=').replace('Original', 'Servidor actualizado'),
      );
    await fixture.whenStable();
    expect(element.querySelector<HTMLTextAreaElement>('#description')?.value).toBe(
      'Servidor actualizado',
    );
  });
});
