import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
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
  readonly busy = input(false);
  readonly showIdSearch = input(false);
  readonly idSearch = output<number | undefined>();
  protected readonly idInput = signal('');
  protected readonly appliedId = signal<number | undefined>(undefined);
  private readonly knownAreas = signal<[number, string][]>([]);
  protected readonly invalidId = computed(() => {
    const value = this.idInput().trim();
    return (
      !!value &&
      (!/^\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) < 1 ||
        Number(value) > 2147483647)
    );
  });
  protected readonly policy = inject(AccessPolicy);
  protected readonly search = signal('');
  protected readonly type = signal('');
  protected readonly area = signal('');
  protected readonly from = signal('');
  protected readonly until = signal('');
  protected readonly page = signal(1);
  protected readonly areas = computed(() =>
    this.showIdSearch()
      ? this.knownAreas()
      : [...new Map(this.records().map((record) => [record.areaId, record.nombreArea])).entries()],
  );
  protected readonly invalidDates = computed(
    () => !!this.from() && !!this.until() && this.from() > this.until(),
  );
  protected readonly filtered = computed(() =>
    this.invalidDates()
      ? []
      : this.records().filter(
          (record) =>
            (this.appliedId() === undefined || record.registroFinancieroId === this.appliedId()) &&
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
      const records = this.records();
      if (this.showIdSearch()) {
        const previous = untracked(this.knownAreas);
        this.knownAreas.set([
          ...new Map([
            ...previous,
            ...records.map((r) => [r.areaId, r.nombreArea] as [number, string]),
          ]).entries(),
        ]);
      }
      this.page.set(1);
    });
  }
  protected applyId(): void {
    if (this.busy() || this.invalidId()) return;
    const value = this.idInput().trim();
    const id = value ? Number(value) : undefined;
    this.appliedId.set(id);
    this.page.set(1);
    this.idSearch.emit(id);
  }
  protected clearId(): void {
    if (this.busy()) return;
    this.idInput.set('');
    this.applyId();
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
