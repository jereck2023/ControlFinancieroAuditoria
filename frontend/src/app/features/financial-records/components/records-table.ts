import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RecordView } from '../models/record-view';
import { AccessPolicy } from '../../../core/auth/access-policy';
import { FinancialAmount } from './amount';
import { Pagination } from '../../../shared/ui/pagination';

@Component({
  selector: 'app-records-table',
  imports: [RouterLink, DatePipe, FinancialAmount, Pagination],
  templateUrl: './records-table.html',
})
export class RecordsTable {
  readonly records = input.required<readonly RecordView[]>();
  protected readonly policy = inject(AccessPolicy);
  protected readonly search = signal('');
  protected readonly type = signal('');
  protected readonly area = signal('');
  protected readonly from = signal('');
  protected readonly until = signal('');
  protected readonly page = signal(1);
  protected readonly areas = computed(() => [
    ...new Map(this.records().map((record) => [record.areaId, record.nombreArea])).entries(),
  ]);
  protected readonly invalidDates = computed(
    () => !!this.from() && !!this.until() && this.from() > this.until(),
  );
  protected readonly filtered = computed(() =>
    this.invalidDates()
      ? []
      : this.records().filter(
          (record) =>
            record.descripcion
              .toLocaleLowerCase('es')
              .includes(this.search().trim().toLocaleLowerCase('es')) &&
            (!this.type() || record.tipoOperacion === this.type()) &&
            (!this.area() || String(record.areaId) === this.area()) &&
            (!this.from() || record.fechaOperacion >= this.from()) &&
            (!this.until() || record.fechaOperacion <= this.until()),
        ),
  );
  protected readonly visible = computed(() =>
    this.filtered().slice((this.page() - 1) * 10, this.page() * 10),
  );
  constructor() {
    effect(() => {
      this.records();
      this.page.set(1);
    });
  }
  protected filter(search: string, type: string, area: string, from: string, until: string): void {
    this.search.set(search);
    this.type.set(type);
    this.area.set(area);
    this.from.set(from);
    this.until.set(until);
    this.page.set(1);
  }
}
