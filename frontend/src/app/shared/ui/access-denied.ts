import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-access-denied',
  imports: [RouterLink],
  template: `<section class="panel panel-body">
    <p class="eyebrow">ACCESO RESTRINGIDO</p>
    <h1>No tiene permiso para acceder</h1>
    <p>Esta sección requiere un perfil de acceso autorizado.</p>
    <a routerLink="/inicio" class="btn btn-primary">Volver al inicio</a>
  </section>`,
})
export class AccessDenied {}
