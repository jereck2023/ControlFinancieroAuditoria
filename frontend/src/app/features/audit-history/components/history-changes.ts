import { Component, computed, input, signal } from '@angular/core';
import { changeFields, DisplayJson } from '../models/history-detail-view';

@Component({
  selector: 'app-history-changes',
  templateUrl: './history-changes.html',
  styles: `
    th[scope='row'] {
      min-width: 8rem;
    }
    .status {
      white-space: nowrap;
    }
    .change-value {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      min-width: 10rem;
      max-width: 35rem;
    }
  `,
})
export class HistoryChanges {
  readonly values = input.required<DisplayJson>();
  protected readonly onlyChanges = signal(true);
  protected readonly fields = computed(() => changeFields(this.values()));
  protected readonly visible = computed(() =>
    this.fields().filter((field) => !this.onlyChanges() || field.modificado),
  );
}
