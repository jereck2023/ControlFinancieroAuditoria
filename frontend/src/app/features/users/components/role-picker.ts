import { Component, input, output } from '@angular/core';
import { Role, ROLES, ROLE_LABELS } from '../../../core/auth/roles';

@Component({
  selector: 'app-role-picker',
  template: ` <fieldset>
    <legend class="form-label">Roles de acceso <span aria-hidden="true">*</span></legend>
    <p class="form-text mb-3">
      Seleccione uno o varios perfiles. Cada operación mantiene sus propias reglas de acceso.
    </p>
    <div class="row g-2">
      @for (role of roles; track role) {
        <div class="col-sm-6">
          <label class="role-option"
            ><input
              class="form-check-input me-2"
              type="checkbox"
              [checked]="selected().includes(role)"
              [disabled]="disabled()"
              (change)="toggle(role)"
            />{{ labels[role] }}</label
          >
        </div>
      }
    </div>
  </fieldset>`,
  styles: `
    .role-option {
      display: block;
      padding: 0.85rem;
      border: 1px solid var(--cfa-border);
      border-radius: 0.45rem;
      font-size: 0.85rem;
    }
  `,
})
export class RolePicker {
  protected readonly roles = ROLES;
  protected readonly labels = ROLE_LABELS;
  readonly selected = input.required<readonly Role[]>();
  readonly disabled = input(false);
  readonly selectedChange = output<Role[]>();
  protected toggle(role: Role): void {
    this.selectedChange.emit(
      this.selected().includes(role)
        ? this.selected().filter((item) => item !== role)
        : [...this.selected(), role],
    );
  }
}
