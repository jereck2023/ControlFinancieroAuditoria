import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnomaliesApi, decodeDetection } from './anomalies-api';
describe('Anomaly detection contract (simulated HTTP)', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });
  it('uses only the existing POST with no filters or request body', () => {
    let result: unknown;
    TestBed.inject(AnomaliesApi)
      .detect()
      .subscribe((value) => (result = value));
    const req = TestBed.inject(HttpTestingController).expectOne('/api/anomalias/detectar');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush({ mensaje: 'Evaluacion de anomalias completada.', nuevasAlertas: 2 });
    expect(result).toEqual({ mensaje: 'Evaluacion de anomalias completada.', nuevasAlertas: 2 });
  });
  it('accepts zero as successful evaluation without inventing alert details', () => {
    expect(decodeDetection({ mensaje: 'Completada', nuevasAlertas: 0 })).toEqual({
      mensaje: 'Completada',
      nuevasAlertas: 0,
    });
  });
  it.each([
    null,
    {},
    { mensaje: '', nuevasAlertas: 0 },
    { mensaje: 'OK', nuevasAlertas: -1 },
    { mensaje: 'OK', nuevasAlertas: 0.5 },
    { mensaje: 'OK', nuevasAlertas: '2' },
  ])('rejects an invalid detection response %j', (value) => {
    expect(() => decodeDetection(value)).toThrow('formato esperado');
  });
});
