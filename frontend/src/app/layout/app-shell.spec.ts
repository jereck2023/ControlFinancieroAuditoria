import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './app-shell';
import { Session } from '../core/auth/session';
import { Role } from '../core/auth/roles';
import { allows } from '../core/auth/access-policy';

describe('Orden institucional del menú y permisos acumulativos', () => {
  afterEach(() => TestBed.resetTestingModule());
  const cases: Role[][] = [
    ['Administrador'],
    ['Auditor'],
    ['JefeArea'],
    ['PersonalArea'],
    ['Administrador', 'Auditor'],
    ['Administrador', 'JefeArea'],
    ['JefeArea', 'Auditor'],
    ['PersonalArea', 'JefeArea', 'Auditor'],
  ];
  it.each(cases.map((roles) => ({ roles })))(
    'ordena los enlaces autorizados de $roles',
    async ({ roles }) => {
      TestBed.configureTestingModule({
        imports: [AppShell],
        providers: [
          provideRouter([]),
          {
            provide: Session,
            useValue: {
              identity: signal({
                roles,
                username: 'QA',
                mustChangePassword: false,
                expiresAt: Date.now() + 60000,
              }),
              end: vi.fn(),
            },
          },
        ],
      });
      const fixture = TestBed.createComponent(AppShell);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      const expected = [
        '/inicio',
        ...(allows(roles, 'read-financial') ? ['/documentos', '/registros'] : []),
        ...(allows(roles, 'write-financial') ? ['/importar-excel'] : []),
        ...(allows(roles, 'read-reports') ? ['/reportes-financieros'] : []),
        ...(allows(roles, 'read-traceability')
          ? ['/historial-auditoria', '/bitacora-actividades']
          : []),
        ...(allows(roles, 'read-alerts') ? ['/alertas'] : []),
        ...(allows(roles, 'read-areas') ? ['/areas'] : []),
        ...(allows(roles, 'manage-users')
          ? ['/usuarios']
          : allows(roles, 'read-area-users')
            ? ['/usuarios-mi-area']
            : []),
      ];
      expect([...el.querySelectorAll('nav a')].map((a) => a.getAttribute('href'))).toEqual(
        expected,
      );
      expect(el.querySelector('a[href="/deteccion-anomalias"]')).toBeNull();
      if (roles.includes('Administrador'))
        expect(el.querySelector('nav')?.textContent).toContain('Gestión de usuarios');
    },
  );
});
