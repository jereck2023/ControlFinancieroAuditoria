import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, describe, expect, it } from 'vitest';
import { Session } from '../../../core/auth/session';
import { AlertDetail } from './alert-detail';
import { alertFixture } from '../testing/alert-fixture';
describe('Alert detail scope and plain-text evidence', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('shows financial actions for Administrator+JefeArea without granting traceability links', async () => {
    TestBed.configureTestingModule({
      imports: [AlertDetail],
      providers: [
        provideRouter([]),
        {
          provide: Session,
          useValue: {
            identity: signal({ roles: ['Administrador', 'JefeArea'], mustChangePassword: false }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(AlertDetail);
    fixture.componentRef.setInput('alert', alertFixture());
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-alert-actions')).not.toBeNull();
    expect(el.querySelector('a[href="/historial-auditoria"]')).toBeNull();
    expect(el.querySelector('a[href="/bitacora-actividades"]')).toBeNull();
  });
  it('does not expose security actions to JefeArea even if an unexpected detail is supplied', async () => {
    TestBed.configureTestingModule({
      imports: [AlertDetail],
      providers: [
        provideRouter([]),
        {
          provide: Session,
          useValue: { identity: signal({ roles: ['JefeArea'], mustChangePassword: false }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(AlertDetail);
    fixture.componentRef.setInput(
      'alert',
      alertFixture({
        codigoRegla: 'LOGIN_FALLIDO_REITERADO',
        areaId: null,
        registroFinancieroId: null,
      }),
    );
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-alert-actions')).toBeNull();
  });
  it('omite evidencia sin interpretación segura y conserva la justificación como texto', async () => {
    TestBed.configureTestingModule({
      imports: [AlertDetail],
      providers: [
        provideRouter([]),
        {
          provide: Session,
          useValue: { identity: signal({ roles: ['Auditor'], mustChangePassword: false }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(AlertDetail);
    fixture.componentRef.setInput(
      'alert',
      alertFixture({
        estado: 'Resuelta',
        evidenciasJson: '<script>evidencia</script>',
        justificacionCierre: 'Cierre con <img src=x onerror=alert(1)>',
      }),
    );
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('<script>evidencia</script>');
    expect(el.textContent).toContain('No hay referencias de evidencias disponibles para mostrar.');
    expect(el.querySelector('pre,details')).toBeNull();
    expect(el.querySelector('script,img')).toBeNull();
    expect(el.textContent).toContain('Cierre con <img');
  });
});
