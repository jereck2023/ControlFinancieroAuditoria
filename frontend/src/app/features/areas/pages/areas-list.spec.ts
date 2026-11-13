import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AreasList } from './areas-list';
import { Session } from '../../../core/auth/session';
import { testToken } from '../../../core/auth/testing/jwt-fixture';

describe('Read-only area consultation', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AreasList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(Session).start(
      testToken({ 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': 'Auditor' }),
    );
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });
  it('renders server-provided names as text and does not grant administrative actions to Auditor', async () => {
    const fixture = TestBed.createComponent(AreasList);
    const name = '<img src=x onerror=alert(1)>';
    TestBed.inject(HttpTestingController)
      .expectOne('/api/areas')
      .flush([{ areaId: 1, nombre: name, activo: true }]);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('tbody')?.textContent).toContain(name);
    expect(element.querySelector('tbody img')).toBeNull();
    expect(element.textContent).not.toContain('Nueva área');
    expect(element.textContent).not.toContain('Desactivar');
  });
});
