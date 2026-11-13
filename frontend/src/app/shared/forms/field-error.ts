import { Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-field-error',
  template: `@if (showError()) {
    <small class="field-error" [id]="errorId()">
      @if (control().hasError('required')) {
        Este campo es obligatorio.
      } @else if (control().hasError('maxlength')) {
        Supera la longitud permitida.
      } @else if (control().hasError('amount')) {
        Ingrese un monto entre 0.01 y 9999999999999999.99, con hasta dos decimales y sin separadores
        de miles.
      } @else if (control().hasError('identifier')) {
        Ingrese un identificador entero entre 1 y 2147483647.
      } @else if (control().hasError('closeJustification')) {
        La justificación debe tener entre 10 y 1000 caracteres después de quitar espacios al inicio
        y al final.
      } @else if (control().hasError('utcDate')) {
        Ingrese una fecha y hora UTC válidas entre los años 0001 y 9999.
      } @else if (control().hasError('operationDate')) {
        Ingrese una fecha válida entre los años 0001 y 9999.
      } @else if (control().hasError('pattern')) {
        Utilice letras sin tildes, números o los caracteres - . _ + y arroba.
      } @else if (control().hasError('passwordPolicy')) {
        Use al menos 12 caracteres, mayúscula, minúscula, número y símbolo.
      } @else {
        Revise el valor ingresado.
      }
    </small>
  }`,
})
export class FieldError {
  readonly control = input.required<AbstractControl>();
  readonly errorId = input.required<string>();
  private readonly changes = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control.events)),
  );
  protected readonly showError = computed(() => {
    this.changes();
    return this.control().invalid && this.control().touched;
  });
}
