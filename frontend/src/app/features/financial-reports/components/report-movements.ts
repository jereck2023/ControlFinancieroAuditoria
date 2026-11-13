import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReportMovementView } from '../models/report-view';
import { ReportAmount } from './report-amount';
@Component({
  selector: 'app-report-movements',
  imports: [ReportAmount, DatePipe, RouterLink],
  template: `<div class="table-responsive">
    <table class="table">
      <caption class="visually-hidden">
        Detalle financiero paginado por el servidor
      </caption>
      <thead>
        <tr>
          <th scope="col">Registro / fecha</th>
          <th scope="col">Operación</th>
          <th scope="col">Descripción</th>
          <th scope="col">Monto</th>
          <th scope="col">Área</th>
          <th scope="col">Usuario</th>
          <th scope="col">Documento</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.registroFinancieroId) {
          <tr>
            <td>
              <a [routerLink]="['/registros', row.registroFinancieroId]">{{
                row.registroFinancieroId
              }}</a
              ><span class="d-block text-nowrap">{{
                row.fechaOperacion | date: 'dd/MM/yyyy' : 'UTC'
              }}</span>
            </td>
            <td>{{ row.tipoOperacion }}</td>
            <td class="report-description">{{ row.descripcion }}</td>
            <td class="text-nowrap">{{ row.monto | reportAmount }}</td>
            <td>{{ row.nombreArea }}</td>
            <td>{{ row.nombreUsuario }}</td>
            <td>
              @if (row.documentoFinancieroId !== null) {
                <a [routerLink]="['/documentos', row.documentoFinancieroId]">{{
                  row.nombreDocumento
                }}</a>
              } @else {
                {{ row.nombreDocumento }}
              }
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="7" class="empty-state">
              No hay operaciones en esta página para los filtros aplicados.
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>`,
  styles: `
    .report-description {
      min-width: 12rem;
      max-width: 30rem;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
  `,
})
export class ReportMovements {
  readonly rows = input.required<ReportMovementView[]>();
}
