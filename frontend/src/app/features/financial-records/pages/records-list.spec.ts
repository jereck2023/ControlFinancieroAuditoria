import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { RecordsList } from './records-list';

const records = Array.from({ length: 12 }, (_, i) => ({
  registroFinancieroId: 21048 + i,
  tipoOperacion: i % 2 === 0 ? 'Ingreso' : 'Egreso',
  descripcion: 'QA fila ' + i,
  fechaOperacion: '2026-11-14',
  monto: 1,
  areaId: 2,
  nombreArea: 'Área QA',
  usuarioId: 7,
  nombreUsuario: 'Persona QA',
  rowVersion: 'AAAAAAAB',
}));
describe('ID exacto y filtros financieros (HTTP simulado)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [RecordsList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  async function setup() {
    const fixture = TestBed.createComponent(RecordsList);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/registros-financieros').flush(JSON.stringify(records));
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const input = (id: string, value: string, event = 'input') => {
      const control = element.querySelector<HTMLInputElement>(id)!;
      control.value = value;
      control.dispatchEvent(new Event(event, { bubbles: true }));
    };
    const click = (text: string) => {
      [...element.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click();
    };
    return { fixture, http, element, input, click };
  }
  it('busca en el servidor, vuelve a página 1 y mantiene filtros al limpiar el ID', async () => {
    const s = await setup();
    s.click('Siguiente');
    await s.fixture.whenStable();
    expect(s.element.textContent).toContain('Página 2');
    s.input('#record-search', 'QA fila');
    s.input('#record-type-filter', 'Ingreso', 'change');
    s.input('#record-id-search', '21048');
    s.click('Buscar');
    await s.fixture.whenStable();
    s.http
      .expectOne('/api/registros-financieros?registroFinancieroId=21048')
      .flush(JSON.stringify([records[0]]));
    await s.fixture.whenStable();
    expect(s.element.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(s.element.querySelector('tbody')?.textContent).toContain('21048');
    expect(s.element.textContent).toContain('Página 1');
    s.click('Limpiar ID');
    s.http.expectOne('/api/registros-financieros').flush(JSON.stringify(records));
    await s.fixture.whenStable();
    expect(s.element.querySelectorAll('tbody tr')).toHaveLength(6);
    expect((s.element.querySelector('#record-search') as HTMLInputElement).value).toBe('QA fila');
    expect((s.element.querySelector('#record-type-filter') as HTMLSelectElement).value).toBe(
      'Ingreso',
    );
  });
  it('no acepta coincidencias parciales ni IDs inválidos', async () => {
    const s = await setup();
    s.input('#record-id-search', '2104');
    s.click('Buscar');
    s.http.expectOne('/api/registros-financieros?registroFinancieroId=2104').flush('[]');
    await s.fixture.whenStable();
    expect(s.element.querySelector('tbody')?.textContent).not.toContain('21048');
    expect(s.element.textContent).toContain('No se encontraron registros');
    s.input('#record-id-search', '0');
    await s.fixture.whenStable();
    expect(s.element.textContent).toContain('Ingrese un ID entero positivo válido.');
    expect(
      [...s.element.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Buscar')!
        .disabled,
    ).toBe(true);
    s.http.expectNone('/api/registros-financieros?registroFinancieroId=0');
  });
});
