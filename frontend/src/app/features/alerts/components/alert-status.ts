import { Component, input } from '@angular/core';
import { alertStateLabel } from '../models/alert-view';
@Component({
  selector: 'app-alert-status',
  template: `<span
    class="status"
    [class.status-warning]="state() === 'Pendiente' || state() === 'En revision'"
    [class.status-active]="state() === 'Resuelta'"
    >{{ label(state()) }}</span
  >`,
})
export class AlertStatus {
  readonly state = input.required<string>();
  protected readonly label = alertStateLabel;
}
