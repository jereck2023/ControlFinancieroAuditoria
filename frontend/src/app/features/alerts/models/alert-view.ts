import { AbstractControl, ValidatorFn } from '@angular/forms';
export function alertStateLabel(state: string): string {
  return state === 'En revision' ? 'En revisión' : state;
}
export function alertFieldLabel(field: string | null): string {
  if (field === null) return 'No aplica';
  const labels: Record<string, string> = {
    TipoOperacion: 'Tipo de operación',
    Descripcion: 'Descripción',
    FechaOperacion: 'Fecha de operación',
    Monto: 'Monto',
  };
  return Object.hasOwn(labels, field) ? labels[field] : 'Campo no identificado';
}
export const closeJustification: ValidatorFn = (control: AbstractControl) => {
  const text: unknown = control.value;
  return typeof text === 'string' && text.trim().length >= 10 && text.trim().length <= 1000
    ? null
    : { closeJustification: true };
};
export function validAlertVersion(value: string): boolean {
  try {
    return atob(value).length === 8;
  } catch {
    return false;
  }
}
export function alertEvidence(value: string): { name: string; ids: number[] }[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const obj = parsed as Record<string, unknown>;
    const fields = [
      ['HistorialesAuditoriaId', 'Historial de auditoría'],
      ['HistorialAuditoriaId', 'Historial de auditoría'],
      ['BitacorasActividadId', 'Bitácora de actividades'],
      ['BitacoraActividadId', 'Bitácora de actividades'],
    ];
    return fields.flatMap(([key, name]) => {
      if (!Object.hasOwn(obj, key)) return [];
      const values: unknown[] = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
      return values.length &&
        values.every(
          (value) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
        )
        ? [{ name, ids: values as number[] }]
        : [];
    });
  } catch {
    return [];
  }
}
