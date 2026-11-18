import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../../core/auth/session';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { PeruTimestamp } from '../../../shared/traceability/peru-timestamp';
import { AlertDetailResponse } from '../models/responses/alert-responses';
import { AlertAction } from '../models/requests/alert-requests';
import { alertEvidence, alertFieldLabel } from '../models/alert-view';
import { AlertActions } from './alert-actions';
import { AlertStatus } from './alert-status';
@Component({
  selector: 'app-alert-detail',
  imports: [RouterLink, PeruTimestamp, AlertActions, AlertStatus],
  templateUrl: './alert-detail.html',
  styles: `
    .alert-text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class AlertDetail {
  readonly alert = input.required<AlertDetailResponse>();
  readonly busy = input(false);
  readonly disabled = input(false);
  readonly error = input('');
  readonly action = output<AlertAction>();
  readonly prepare = output<void>();
  protected readonly policy = inject(AccessPolicy);
  protected readonly fieldLabel = alertFieldLabel;
  private readonly session = inject(Session);
  protected readonly evidence = computed(() => alertEvidence(this.alert().evidenciasJson));
  protected readonly mayAct = computed(
    () =>
      this.policy.can('manage-alerts') &&
      (this.session.identity()?.roles.includes('Auditor') ||
        (this.alert().areaId !== null &&
          this.alert().registroFinancieroId !== null &&
          this.alert().codigoRegla !== 'LOGIN_FALLIDO_REITERADO')),
  );
}
