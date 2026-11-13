import { Component, input } from '@angular/core';
import { ReportTotalsView } from '../models/report-view';
import { ReportAmount } from './report-amount';
@Component({
  selector: 'app-report-totals',
  imports: [ReportAmount],
  template: `<div class="row g-3 mb-4" aria-label="Indicadores del período">
      <div class="col-lg-4">
        <section class="panel panel-body h-100">
          <p class="eyebrow">INGRESOS</p>
          <p class="h4 report-total">{{ totals().totalIngresos | reportAmount }}</p>
          <span class="text-secondary">{{ totals().cantidadIngresos }} operaciones</span>
        </section>
      </div>
      <div class="col-lg-4">
        <section class="panel panel-body h-100">
          <p class="eyebrow">EGRESOS</p>
          <p class="h4 report-total">{{ totals().totalEgresos | reportAmount }}</p>
          <span class="text-secondary">{{ totals().cantidadEgresos }} operaciones</span>
        </section>
      </div>
      <div class="col-lg-4">
        <section class="panel panel-body h-100">
          <p class="eyebrow">DIFERENCIA</p>
          <p class="h4 report-total">{{ totals().diferencia | reportAmount }}</p>
          <span class="text-secondary">Ingresos menos egresos</span>
        </section>
      </div>
    </div>
    <p class="form-text mb-4">
      Totales de todo el período filtrado, independientemente de la página. La diferencia no
      representa saldo disponible ni presupuesto restante. Los importes se muestran sin asignar una
      moneda que la API no especifica.
    </p>`,
  styles: `
    .report-total {
      white-space: nowrap;
      overflow-x: auto;
      font-size: clamp(1rem, 1.35vw, 1.35rem);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class ReportTotals {
  readonly totals = input.required<ReportTotalsView>();
}
