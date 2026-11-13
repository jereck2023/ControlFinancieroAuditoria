import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { readJwt, SessionIdentity } from './jwt';

export type SessionEnd =
  'logout' | 'expired' | 'unauthorized' | 'password-changed' | 'access-changed';
const STORAGE_KEY = 'cfa.access-token';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly identityState = signal<SessionIdentity | null>(null);
  private token: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  readonly identity = this.identityState.asReadonly();
  readonly authenticated = computed(() => this.identityState() !== null);
  readonly endReason = signal<SessionEnd | null>(null);

  constructor() {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const identity = readJwt(stored);
        if (identity) this.activate(stored, identity);
        else {
          sessionStorage.removeItem(STORAGE_KEY);
          this.endReason.set('expired');
        }
      }
    } catch {
      /* Restricted browser storage leaves the user signed out. */
    }
    const check = () => this.checkExpiry();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    });
  }

  start(token: string): void {
    const identity = readJwt(token);
    if (!identity) throw new Error('La API devolvió una sesión inválida o vencida.');
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      throw new Error('El navegador debe permitir el almacenamiento de sesión para ingresar.');
    }
    this.endReason.set(null);
    this.activate(token, identity);
  }

  validToken(): string | null {
    this.checkExpiry();
    return this.token;
  }

  checkExpiry(): void {
    const identity = this.identityState();
    if (identity && identity.expiresAt <= Date.now()) this.end('expired');
  }

  requirePasswordChange(): void {
    const identity = this.identityState();
    if (!identity) return;
    this.identityState.set({ ...identity, mustChangePassword: true });
    void this.router.navigateByUrl('/cambiar-password');
  }

  end(reason: SessionEnd = 'logout'): void {
    clearTimeout(this.timer);
    this.token = null;
    this.identityState.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* No token retained in memory. */
    }
    this.endReason.set(reason);
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private activate(token: string, identity: SessionIdentity): void {
    clearTimeout(this.timer);
    this.token = token;
    this.identityState.set(identity);
    // No rolling expiry. Always use the JWT exp emitted by the API.
    this.timer = setTimeout(
      () => {
        this.checkExpiry();
        if (this.identityState()) this.activate(token, identity);
      },
      Math.min(identity.expiresAt - Date.now(), 2_147_483_647),
    );
  }
}
