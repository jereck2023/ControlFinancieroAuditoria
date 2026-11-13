import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch(() => {
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = 'No se pudo iniciar CFA. Recargue la página o contacte al administrador.';
  document.querySelector('app-root')?.replaceChildren(message);
});
