import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { ImportPage } from './import-page';

describe('Import preview lifecycle (mocked HTTP)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ImportPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });
  const valid =
    '{"totalFilas":1,"registros":[{"numeroFila":2,"tipoOperacion":"Ingreso","descripcion":"Prueba","fechaOperacion":"2026-11-11","monto":12.34}],"errores":[],"esValido":true,"hashArchivo":"HASH_ORIGINAL"}';
  function choose(element: HTMLElement, file: File) {
    const input = element.querySelector<HTMLInputElement>('#excel-file');
    if (!input) throw new Error('Missing upload input');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: { item: (index: number) => (index === 0 ? file : null), length: 1 },
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function button(element: HTMLElement, text: string) {
    const found = [...element.querySelectorAll<HTMLButtonElement>('button')].find(
      (item) => item.textContent?.trim() === text,
    );
    if (!found) throw new Error('Missing button: ' + text);
    return found;
  }
  it('invalidates a validated preview when the selected file changes', async () => {
    const fixture = TestBed.createComponent(ImportPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    choose(element, new File(['first'], 'first.xlsx'));
    await fixture.whenStable();
    button(element, 'Validar archivo').click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/registros-financieros/importar/vista-previa')
      .flush(valid);
    await fixture.whenStable();
    expect(button(element, 'Confirmar importación').disabled).toBe(false);
    choose(element, new File(['second'], 'second.xlsx'));
    await fixture.whenStable();
    expect(element.textContent).not.toContain('2 · REVISAR VISTA PREVIA');
    TestBed.inject(HttpTestingController).expectNone(
      '/api/registros-financieros/importar/confirmar',
    );
  });
  it('blocks confirmation and renders row errors when preview is invalid', async () => {
    const fixture = TestBed.createComponent(ImportPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    choose(element, new File(['bad'], 'bad.xlsx'));
    await fixture.whenStable();
    button(element, 'Validar archivo').click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/registros-financieros/importar/vista-previa')
      .flush(
        valid
          .replace('"esValido":true', '"esValido":false')
          .replace(
            '"errores":[]',
            '"errores":[{"numeroFila":3,"mensaje":"<script>Fila inválida</script>"}]',
          ),
      );
    await fixture.whenStable();
    expect(button(element, 'Confirmar importación').disabled).toBe(true);
    expect(element.textContent).toContain('<script>Fila inválida</script>');
    expect(element.querySelector('script')).toBeNull();
  });
  it('confirms the same file/hash and releases the preview after success', async () => {
    const show = HTMLDialogElement.prototype.showModal;
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value: vi.fn(),
    });
    try {
      const fixture = TestBed.createComponent(ImportPage);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const file = new File(['same'], 'same.xlsx');
      choose(element, file);
      await fixture.whenStable();
      button(element, 'Validar archivo').click();
      const testing = TestBed.inject(HttpTestingController);
      testing.expectOne('/api/registros-financieros/importar/vista-previa').flush(valid);
      await fixture.whenStable();
      button(element, 'Confirmar importación').click();
      await fixture.whenStable();
      button(element, 'Confirmar').click();
      const request = testing.expectOne('/api/registros-financieros/importar/confirmar');
      expect(request.request.body.get('archivo')).toBe(file);
      expect(request.request.body.get('hashArchivo')).toBe('HASH_ORIGINAL');
      request.flush({
        mensaje: 'ok',
        documentoFinancieroId: 4,
        nombreArchivo: 'same.xlsx',
        totalImportados: 1,
        registrosIds: [8],
      });
      await fixture.whenStable();
      expect(element.textContent).toContain('Importación completada');
      expect(element.querySelector('dialog')).toBeNull();
    } finally {
      Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
        configurable: true,
        value: show,
      });
    }
  });
});
