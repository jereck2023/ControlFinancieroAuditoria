import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { InformationDialog } from './information-dialog';
import { stubDialogMethods } from './dialog-test-support';

@Component({
  imports: [InformationDialog],
  template: `<button (click)="open.set(true)">Ver</button>
    <input aria-label="Filtro conservado" value="Área QA" />
    @if (open()) {
      <app-information-dialog title="Detalle de prueba" [busy]="busy()" (dismiss)="open.set(false)">
        <p>{{ longText }}</p>
        <dialog class="nested-confirmation">
          <button type="button">Confirmación anidada</button>
        </dialog>
      </app-information-dialog>
    }`,
})
class Host {
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly longText = 'Descripción financiera de prueba. '.repeat(100);
}

describe('Ventana informativa (sin geometría de navegador)', () => {
  let restoreDialog: () => void;
  beforeEach(() => {
    restoreDialog = stubDialogMethods();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    restoreDialog();
  });
  it('abre contenido extenso y cierra por botón y cancelación sin reconstruir el filtro', async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const filter = element.querySelector('input');
    const open = element.querySelector<HTMLButtonElement>('button')!;
    const previousOverflow = document.documentElement.style.overflow;
    for (const mode of ['button', 'cancel']) {
      open.click();
      await fixture.whenStable();
      const dialog = element.querySelector('dialog')!;
      expect(dialog.open).toBe(true);
      expect(dialog.getAttribute('aria-labelledby')).toBe('information-title');
      expect(dialog.querySelector('.information-body')?.textContent).toContain(
        fixture.componentInstance.longText,
      );
      expect(document.documentElement.style.overflow).toBe('hidden');
      if (mode === 'button') dialog.querySelector('button')!.click();
      else dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
      await fixture.whenStable();
      expect(element.querySelector('dialog')).toBeNull();
      expect(element.querySelector('input')).toBe(filter);
      expect(filter?.value).toBe('Área QA');
      expect(document.documentElement.style.overflow).toBe(previousOverflow);
    }
  });
  it('bloquea el cierre ocupado y no consume la cancelación de una confirmación anidada', async () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.open.set(true);
    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement,
      dialog = el.querySelector('dialog')!;
    expect(dialog.querySelector('button')!.disabled).toBe(true);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(el.querySelector('app-information-dialog')).not.toBeNull();
    fixture.componentInstance.busy.set(false);
    await fixture.whenStable();
    const nested = el.querySelector('.nested-confirmation')!;
    const key = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    nested.querySelector('button')!.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    nested.dispatchEvent(new Event('cancel', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(el.querySelector('app-information-dialog')).not.toBeNull();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(el.querySelector('app-information-dialog')).toBeNull();
  });
});
