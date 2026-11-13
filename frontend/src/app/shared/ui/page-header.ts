import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `<header class="page-header">
    <div>
      <p class="eyebrow">{{ eyebrow() }}</p>
      <h1>{{ title() }}</h1>
      <p class="page-description">{{ description() }}</p>
    </div>
    <div class="page-actions"><ng-content /></div>
  </header>`,
})
export class PageHeader {
  readonly eyebrow = input('ADMINISTRACIÓN INSTITUCIONAL');
  readonly title = input.required<string>();
  readonly description = input('');
}
