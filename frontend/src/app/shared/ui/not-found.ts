import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `<section class="panel panel-body">
    <p class="eyebrow">404</p>
    <h1>Página no encontrada</h1>
    <p>La dirección solicitada no está disponible.</p>
    <a routerLink="/inicio" class="btn btn-primary">Volver al inicio</a>
  </section>`,
})
export class NotFound {}
