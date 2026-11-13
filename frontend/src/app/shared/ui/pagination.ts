import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'app-pagination',
  template: `<nav class="pagination-bar" aria-label="Paginación del listado">
    <span>{{ total() }} resultados · Página {{ page() }} de {{ pages() }}</span>
    <div class="d-flex gap-2">
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        [disabled]="page() <= 1"
        (click)="pageChange.emit(page() - 1)"
      >
        Anterior
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm"
        [disabled]="page() >= pages()"
        (click)="pageChange.emit(page() + 1)"
      >
        Siguiente
      </button>
    </div>
  </nav>`,
})
export class Pagination {
  readonly total = input.required<number>();
  readonly page = input.required<number>();
  readonly size = input(10);
  readonly pageChange = output<number>();
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
}
