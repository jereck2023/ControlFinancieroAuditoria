import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../core/auth/session';
import { AccessPolicy } from '../../core/auth/access-policy';
import { PageHeader } from '../../shared/ui/page-header';

@Component({
  selector: 'app-home',
  imports: [PageHeader, RouterLink],
  template: ` <app-page-header
      eyebrow="ESPACIO INSTITUCIONAL"
      title="Bienvenido a CFA"
      description="Control de acceso y administración de la plataforma institucional."
    />
    <section class="panel panel-body mb-4">
      <p class="eyebrow">SU ESPACIO DE TRABAJO</p>
      <h2>{{ session.identity()?.username }}</h2>
      <p class="text-secondary mb-0">
        Seleccione una opción para consultar o administrar la información según sus permisos.
      </p>
    </section>
    <div class="row g-4">
      @if (policy.can('read-alerts')) {
        <div class="col-md-6">
          <a routerLink="/alertas" class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">SEGUIMIENTO</p>
            <h2>Gestión de alertas →</h2>
            <p class="text-secondary mb-0">
              Consulte evidencias, inicie la revisión y registre un cierre justificado.
            </p></a
          >
        </div>
      }
      @if (policy.can('detect-anomalies')) {
        <div class="col-md-6">
          <a
            routerLink="/deteccion-anomalias"
            class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">REGLAS PREDEFINIDAS</p>
            <h2>Detección de anomalías →</h2>
            <p class="text-secondary mb-0">
              Solicite una evaluación y consulte cuántas alertas nuevas generó el servidor.
            </p></a
          >
        </div>
      }
      @if (policy.can('read-reports')) {
        <div class="col-md-6">
          <a
            routerLink="/reportes-financieros"
            class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">REPORTES FINANCIEROS</p>
            <h2>Resumen y detalle →</h2>
            <p class="text-secondary mb-0">
              Consulte ingresos, egresos y diferencia por período y exporte sus resultados.
            </p></a
          >
        </div>
      }
      @if (policy.can('read-traceability')) {
        <div class="col-md-6">
          <a
            routerLink="/historial-auditoria"
            class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">TRAZABILIDAD</p>
            <h2>Historial de auditoría →</h2>
            <p class="text-secondary mb-0">
              Quién modificó un registro y qué valores cambiaron.
            </p></a
          >
        </div>
        <div class="col-md-6">
          <a
            routerLink="/bitacora-actividades"
            class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">ACTIVIDAD DEL SISTEMA</p>
            <h2>Bitácora de actividades →</h2>
            <p class="text-secondary mb-0">Eventos registrados y sus resultados.</p></a
          >
        </div>
      }
      @if (policy.can('read-financial')) {
        <div class="col-md-6">
          <a routerLink="/documentos" class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">DOCUMENTOS FINANCIEROS</p>
            <h2>Documentos importados →</h2>
            <p class="text-secondary mb-0">
              Consulte documentos y exporte sus registros actuales.
            </p></a
          >
        </div>
        <div class="col-md-6">
          <a routerLink="/registros" class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">INFORMACIÓN ESTRUCTURADA</p>
            <h2>Registros financieros →</h2>
            <p class="text-secondary mb-0">Revise operaciones según su alcance autorizado.</p></a
          >
        </div>
      }
      @if (policy.can('read-areas')) {
        <div class="col-md-6">
          <a routerLink="/areas" class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">ORGANIZACIÓN</p>
            <h2>Áreas institucionales <span aria-hidden="true">→</span></h2>
            <p class="text-secondary mb-0">Consulte las áreas y su estado actual.</p></a
          >
        </div>
      }
      @if (policy.can('manage-users')) {
        <div class="col-md-6">
          <a routerLink="/usuarios" class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">ACCESO AL SISTEMA</p>
            <h2>Usuarios y roles <span aria-hidden="true">→</span></h2>
            <p class="text-secondary mb-0">
              Administre cuentas, perfiles de acceso y asignaciones.
            </p></a
          >
        </div>
      } @else if (policy.can('read-area-users')) {
        <div class="col-md-6">
          <a
            routerLink="/usuarios-mi-area"
            class="panel panel-body d-block h-100 text-decoration-none"
            ><p class="eyebrow">EQUIPO INSTITUCIONAL</p>
            <h2>Usuarios de mi área <span aria-hidden="true">→</span></h2>
            <p class="text-secondary mb-0">Consulte las cuentas, roles y estados de su área.</p></a
          >
        </div>
      }
    </div>`,
})
export class Home {
  protected readonly session = inject(Session);
  protected readonly policy = inject(AccessPolicy);
}
