import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Feedback } from '../../../shared/ui/feedback';
import { DetectionResponse } from '../models/responses/detection-response';
@Component({
  selector: 'app-detection-result',
  imports: [Feedback, RouterLink],
  template: `<section
    class="panel panel-body mt-4"
    aria-label="Resultado de la ejecución"
    aria-live="polite"
  >
    <h2>Resultado de la ejecución</h2>
    <app-feedback [message]="result().mensaje" kind="success" />
    <p class="eyebrow mt-3">ALERTAS NUEVAS CREADAS POR ESTA SOLICITUD</p>
    <p class="display-6 fw-semibold">{{ result().nuevasAlertas }}</p>
    @if (result().nuevasAlertas === 0) {
      <p>
        El servidor no creó nuevas alertas en esta ejecución. Este resultado no confirma la ausencia
        de anomalías ni de alertas previas.
      </p>
    } @else {
      <p>El servidor registró nuevas alertas para su posterior seguimiento.</p>
    }
    <p class="form-text mb-0">
      La respuesta no incluye el detalle de las alertas ni un conteo por regla. El seguimiento y la
      gestión de sus estados se realizan en la sección de alertas.
    </p>
    <a routerLink="/alertas" class="btn btn-outline-primary mt-3">Consultar y gestionar alertas</a>
  </section>`,
})
export class DetectionResult {
  readonly result = input.required<DetectionResponse>();
}
