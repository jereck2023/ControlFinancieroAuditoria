import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { authInterceptor } from './auth-interceptor';
import { Session } from '../auth/session';
import { testToken } from '../auth/testing/jwt-fixture';

describe('Bearer interceptor', () => {
  let http: HttpClient;
  let testing: HttpTestingController;
  let session: Session;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    http = TestBed.inject(HttpClient);
    testing = TestBed.inject(HttpTestingController);
    session = TestBed.inject(Session);
    session.start(testToken());
  });
  afterEach(() => {
    testing.verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });
  it('attaches the token only to our API', () => {
    http.get('/api/areas').subscribe();
    const request = testing.expectOne('/api/areas');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${session.validToken()}`);
    request.flush([]);
    for (const url of ['https://example.org/api/areas', '/api-other/areas', '/assets/logo.svg']) {
      http.get(url).subscribe();
      const other = testing.expectOne(url);
      expect(other.request.headers.has('Authorization')).toBe(false);
      other.flush({});
    }
  });
  it('does not attach a JWT or end a session for a failed login', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    const request = testing.expectOne('/api/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.authenticated()).toBe(true);
  });
  it('clears the session on authenticated 401', () => {
    http.get('/api/areas').subscribe({ error: () => undefined });
    testing.expectOne('/api/areas').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.authenticated()).toBe(false);
    expect(sessionStorage.getItem('cfa.access-token')).toBeNull();
  });
  it('keeps the session on ordinary 403', () => {
    http.get('/api/usuarios').subscribe({ error: () => undefined });
    testing.expectOne('/api/usuarios').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(session.authenticated()).toBe(true);
  });
  it('redirects mandatory password 403 without logging out', () => {
    http.get('/api/areas').subscribe({ error: () => undefined });
    testing
      .expectOne('/api/areas')
      .flush(
        { mensaje: 'Debe cambiar su contraseña antes de continuar.' },
        { status: 403, statusText: 'Forbidden' },
      );
    expect(session.identity()?.mustChangePassword).toBe(true);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/cambiar-password');
  });
  it('does not invalidate a new session because of a late old 401', () => {
    http.get('/api/areas').subscribe({ error: () => undefined });
    const request = testing.expectOne('/api/areas');
    session.start(testToken({ sub: '8', unique_name: 'otro.admin' }));
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(session.identity()?.userId).toBe(8);
  });
});
