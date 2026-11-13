import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './login';
import { Session } from '../../../core/auth/session';
import { testToken } from '../../../core/auth/testing/jwt-fixture';

describe('Login flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });
  it('shows field errors after empty submit without making an API call', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(element.querySelectorAll('.field-error').length).toBe(2);
    TestBed.inject(HttpTestingController).expectNone('/api/auth/login');
  });
  it('restores claims, clears password and routes mandatory change after login', async () => {
    const fixture = TestBed.createComponent(Login);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const username = element.querySelector<HTMLInputElement>('#username');
    const password = element.querySelector<HTMLInputElement>('#password');
    if (!username || !password) throw new Error('Missing login fields');
    username.value = 'prueba.admin';
    username.dispatchEvent(new Event('input', { bubbles: true }));
    password.value = 'TemporaryPass1!';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    element
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ username: 'prueba.admin', password: 'TemporaryPass1!' });
    request.flush({
      token: testToken({ DebeCambiarPassword: 'true' }),
      mensaje: 'ok',
      roles: ['Administrador'],
      usuario: 'prueba.admin',
      expiracion: '',
      debeCambiarPassword: true,
    });
    await fixture.whenStable();
    expect(TestBed.inject(Session).identity()?.mustChangePassword).toBe(true);
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith('/cambiar-password', {
      replaceUrl: true,
    });
    expect(password.value).toBe('');
  });
});
