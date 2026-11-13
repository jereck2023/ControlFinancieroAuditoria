import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Session } from './session';
import { AccessPolicy, Permission } from './access-policy';

export const authGuard: CanActivateFn = () => {
  const session = inject(Session);
  session.checkExpiry();
  return session.authenticated() || inject(Router).parseUrl('/login');
};

export const completeSessionGuard: CanActivateFn = () => {
  const session = inject(Session);
  session.checkExpiry();
  const router = inject(Router);
  if (!session.authenticated()) return router.parseUrl('/login');
  return !session.identity()?.mustChangePassword || router.parseUrl('/cambiar-password');
};

export const guestGuard: CanActivateFn = () => {
  const session = inject(Session);
  session.checkExpiry();
  if (!session.authenticated()) return true;
  return inject(Router).parseUrl(
    session.identity()?.mustChangePassword ? '/cambiar-password' : '/inicio',
  );
};

export function permissionGuard(permission: Permission): CanActivateFn {
  return () => inject(AccessPolicy).can(permission) || inject(Router).parseUrl('/acceso-denegado');
}
