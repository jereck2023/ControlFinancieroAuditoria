import { Component, computed, input, signal } from '@angular/core';
import { changeFields, displayJson, DisplayJson } from '../models/history-detail-view';

@Component({
  selector: 'app-history-changes',
  templateUrl: './history-changes.html',
  styles: `
    .change-value {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      min-width: 10rem;
      max-width: 35rem;
    }
    pre {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 0.8rem;
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
  protected readonly raw = computed(() => displayJson(this.values()));
}
