import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { from, mergeMap, Observable, throwError } from 'rxjs';

export function downloadXlsx(response: HttpResponse<Blob>, fallback: string): void {
  if (!response.body?.size) throw new Error('La API devolvió un archivo vacío.');
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let name = fallback;
  try {
    name = encoded ? decodeURIComponent(encoded) : (plain ?? fallback);
  } catch {
    /* Keep safe fallback. */
  }
  name = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
  if (!name.toLowerCase().endsWith('.xlsx')) name = fallback;
  const url = URL.createObjectURL(response.body);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function decodeDownloadError(error: unknown): Observable<never> {
  if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
    return from(error.error.text()).pipe(
      mergeMap((body) =>
        throwError(
          () =>
            new HttpErrorResponse({
              error: body,
              status: error.status,
              statusText: error.statusText,
            }),
        ),
      ),
    );
  }
  return throwError(() => error);
}
