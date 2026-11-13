import { Component, input } from '@angular/core';
import { ReportGroupView } from '../models/report-view';
import { ReportAmount } from './report-amount';
@Component({
  selector: 'app-report-groups',
  imports: [ReportAmount],
  template: `<div class="table-responsive">
    <table class="table">
      <caption class="visually-hidden">
        Resumen financiero agrupado
      </caption>
      <thead>
        <tr>
          <th scope="col">Grupo</th>
          <th scope="col">Ingresos (cantidad)</th>
          <th scope="col">Total ingresos</th>
          <th scope="col">Egresos (cantidad)</th>
          <th scope="col">Total egresos</th>
          <th scope="col">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        @for (group of groups(); track group.grupoId) {
          <tr>
            <th scope="row">
              {{ group.nombreGrupo }}
              @if (group.grupoId !== null) {
                <small class="d-block text-secondary">ID {{ group.grupoId }}</small>
              }
            </th>
            <td>{{ group.cantidadIngresos }}</td>
            <td class="text-nowrap">{{ group.totalIngresos | reportAmount }}</td>
            <td>{{ group.cantidadEgresos }}</td>
            <td class="text-nowrap">{{ group.totalEgresos | reportAmount }}</td>
            <td class="text-nowrap">{{ group.diferencia | reportAmount }}</td>
          </tr>
        } @empty {
          <tr>
            <td colspan="6" class="empty-state">
              No hay grupos en esta página para los filtros aplicados.
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>`,
})
export class ReportGroups {
  readonly groups = input.required<ReportGroupView[]>();
}
