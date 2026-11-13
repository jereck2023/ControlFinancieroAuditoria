import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Session } from './session';
import { testToken } from './testing/jwt-fixture';

describe('Session lifecycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
    vi.useRealTimers();
  });
  it('reconstructs the session after reload from sessionStorage', () => {
    const token = testToken();
    sessionStorage.setItem('cfa.access-token', token);
    const session = TestBed.inject(Session);
    expect(session.identity()?.username).toBe('prueba.admin');
    expect(session.validToken()).toBe(token);
  });
  it('removes expired storage on initialization', () => {
    sessionStorage.setItem('cfa.access-token', testToken({ exp: 1 }));
    expect(TestBed.inject(Session).authenticated()).toBe(false);
    expect(sessionStorage.getItem('cfa.access-token')).toBeNull();
  });
  it('clears only CFA session data on local logout', () => {
    sessionStorage.setItem('unrelated', 'keep');
    const session = TestBed.inject(Session);
    session.start(testToken());
    session.end();
    expect(session.identity()).toBeNull();
    expect(session.validToken()).toBeNull();
    expect(sessionStorage.getItem('cfa.access-token')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });
  it('automatically expires using server exp', () => {
    vi.useFakeTimers();
    const session = TestBed.inject(Session);
    const exp = Math.floor(Date.now() / 1000) + 2;
    session.start(testToken({ exp }));
    vi.advanceTimersByTime(exp * 1000 - Date.now());
    expect(session.authenticated()).toBe(false);
    expect(session.endReason()).toBe('expired');
  });
  it('rechecks expiry on focus after suspension', () => {
    vi.useFakeTimers();
    const session = TestBed.inject(Session);
    session.start(testToken());
    vi.setSystemTime(Date.now() + 3_600_000);
    window.dispatchEvent(new Event('focus'));
    expect(session.authenticated()).toBe(false);
  });
  it('fails explicitly when the browser blocks persistent session storage', () => {
    const session = TestBed.inject(Session);
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(() => session.start(testToken())).toThrow('almacenamiento');
    expect(session.authenticated()).toBe(false);
    spy.mockRestore();
  });
});
