import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Session } from '../auth/session';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(Session);
  const url = new URL(request.url, window.location.origin);
  const base = new URL(environment.apiBaseUrl + '/', window.location.origin);
  const isApi = url.origin === base.origin && url.pathname.startsWith(base.pathname);
  if (!isApi) return next(request);
  const isLogin = url.pathname === base.pathname + 'auth/login';
  const token = isLogin ? null : session.validToken();
  const authorized = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(authorized).pipe(
    catchError((error: unknown) => {
      // Ignore late failures belonging to an older, already replaced session.
      if (error instanceof HttpErrorResponse && token && session.validToken() === token) {
        if (error.status === 401) session.end('unauthorized');
        else if (error.status === 403 && isMandatoryPasswordResponse(error.error))
          session.requirePasswordChange();
      }
      return throwError(() => error);
    }),
  );
};

function isMandatoryPasswordResponse(body: unknown): boolean {
  return (
    !!body &&
    typeof body === 'object' &&
    'mensaje' in body &&
    body.mensaje === 'Debe cambiar su contraseña antes de continuar.'
  );
}
