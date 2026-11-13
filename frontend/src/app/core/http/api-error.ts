import { HttpErrorResponse } from '@angular/common/http';

export function errorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse))
    return error instanceof Error ? error.message : 'No se pudo completar la operación.';
  if (error.status === 0)
    return 'No se pudo conectar con la API. Compruebe la conexión y vuelva a intentar.';
  let body: unknown = error.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      /* Never render raw server HTML. */
    }
  }
  if (body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    const messages: string[] = [];
    if (typeof data['mensaje'] === 'string') messages.push(data['mensaje']);
    const errors = data['errores'] ?? data['errors'];
    if (Array.isArray(errors))
      messages.push(...errors.filter((e): e is string => typeof e === 'string'));
    else if (errors && typeof errors === 'object') {
      for (const value of Object.values(errors)) {
        if (Array.isArray(value))
          messages.push(...value.filter((e): e is string => typeof e === 'string'));
      }
    }
    if (messages.length) return [...new Set(messages)].join(' ');
  }
  if (error.status === 401) return 'La sesión no es válida o las credenciales son incorrectas.';
  if (error.status === 403) return 'No tiene permiso para realizar esta operación.';
  if (error.status === 404) return 'No se encontró el elemento solicitado.';
  if (error.status === 409)
    return 'La operación entra en conflicto con el estado actual. Actualice los datos.';
  return 'No se pudo completar la operación. Intente nuevamente.';
}
