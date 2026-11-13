import { Routes } from '@angular/router';
import {
  authGuard,
  completeSessionGuard,
  guestGuard,
  permissionGuard,
} from './core/auth/auth-guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Ingresar | CFA',
    loadComponent: () => import('./features/auth/pages/login').then((m) => m.Login),
  },
  {
    path: 'cambiar-password',
    canActivate: [authGuard],
    title: 'Cambiar contraseña | CFA',
    loadComponent: () =>
      import('./features/auth/pages/change-password').then((m) => m.ChangePassword),
  },
  {
    path: '',
    canActivate: [completeSessionGuard],
    canActivateChild: [completeSessionGuard],
    loadComponent: () => import('./layout/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'alertas',
        canActivate: [permissionGuard('read-alerts')],
        title: 'Gestión de alertas | CFA',
        loadComponent: () =>
          import('./features/alerts/pages/alerts-page').then((m) => m.AlertsPage),
      },
      {
        path: 'deteccion-anomalias',
        canActivate: [permissionGuard('detect-anomalies')],
        title: 'Detección de anomalías | CFA',
        loadComponent: () =>
          import('./features/anomaly-detection/pages/detection-page').then((m) => m.DetectionPage),
      },
      {
        path: 'reportes-financieros',
        canActivate: [permissionGuard('read-reports')],
        title: 'Reportes financieros | CFA',
        loadComponent: () =>
          import('./features/financial-reports/pages/reports-page').then((m) => m.ReportsPage),
      },
      {
        path: 'historial-auditoria',
        canActivate: [permissionGuard('read-traceability')],
        title: 'Historial de auditoría | CFA',
        loadComponent: () =>
          import('./features/audit-history/pages/history-page').then((m) => m.HistoryPage),
      },
      {
        path: 'bitacora-actividades',
        canActivate: [permissionGuard('read-traceability')],
        title: 'Bitácora de actividades | CFA',
        loadComponent: () =>
          import('./features/activity-log/pages/activity-page').then((m) => m.ActivityPage),
      },
      {
        path: 'documentos',
        canActivate: [permissionGuard('read-financial')],
        title: 'Documentos financieros | CFA',
        loadComponent: () =>
          import('./features/financial-documents/pages/documents-list').then(
            (m) => m.DocumentsList,
          ),
      },
      {
        path: 'documentos/:id',
        canActivate: [permissionGuard('read-financial')],
        title: 'Documento financiero | CFA',
        loadComponent: () =>
          import('./features/financial-documents/pages/document-detail').then(
            (m) => m.DocumentDetail,
          ),
      },
      {
        path: 'registros',
        canActivate: [permissionGuard('read-financial')],
        title: 'Registros financieros | CFA',
        loadComponent: () =>
          import('./features/financial-records/pages/records-list').then((m) => m.RecordsList),
      },
      {
        path: 'registros/nuevo',
        canActivate: [permissionGuard('write-financial')],
        title: 'Nuevo registro | CFA',
        loadComponent: () =>
          import('./features/financial-records/pages/record-form').then((m) => m.RecordForm),
      },
      {
        path: 'registros/:id/editar',
        canActivate: [permissionGuard('write-financial')],
        title: 'Editar registro | CFA',
        loadComponent: () =>
          import('./features/financial-records/pages/record-form').then((m) => m.RecordForm),
      },
      {
        path: 'registros/:id',
        canActivate: [permissionGuard('read-financial')],
        title: 'Detalle del registro | CFA',
        loadComponent: () =>
          import('./features/financial-records/pages/record-detail').then((m) => m.RecordDetail),
      },
      {
        path: 'importar-excel',
        canActivate: [permissionGuard('write-financial')],
        title: 'Importar Excel | CFA',
        loadComponent: () =>
          import('./features/financial-import/pages/import-page').then((m) => m.ImportPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio | CFA',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
      },
      {
        path: 'areas',
        canActivate: [permissionGuard('read-areas')],
        title: 'Áreas | CFA',
        loadComponent: () => import('./features/areas/pages/areas-list').then((m) => m.AreasList),
      },
      {
        path: 'areas/nueva',
        canActivate: [permissionGuard('manage-areas')],
        title: 'Nueva área | CFA',
        loadComponent: () => import('./features/areas/pages/area-form').then((m) => m.AreaForm),
      },
      {
        path: 'areas/:id/editar',
        canActivate: [permissionGuard('manage-areas')],
        title: 'Editar área | CFA',
        loadComponent: () => import('./features/areas/pages/area-form').then((m) => m.AreaForm),
      },
      {
        path: 'usuarios',
        canActivate: [permissionGuard('manage-users')],
        title: 'Usuarios | CFA',
        loadComponent: () => import('./features/users/pages/users-list').then((m) => m.UsersList),
      },
      {
        path: 'usuarios/nuevo',
        canActivate: [permissionGuard('manage-users')],
        title: 'Nuevo usuario | CFA',
        loadComponent: () => import('./features/users/pages/user-form').then((m) => m.UserForm),
      },
      {
        path: 'usuarios/:id/editar',
        canActivate: [permissionGuard('manage-users')],
        title: 'Editar usuario | CFA',
        loadComponent: () => import('./features/users/pages/user-form').then((m) => m.UserForm),
      },
      {
        path: 'usuarios/:id/roles',
        canActivate: [permissionGuard('manage-users')],
        title: 'Asignar roles | CFA',
        loadComponent: () => import('./features/users/pages/user-roles').then((m) => m.UserRoles),
      },
      {
        path: 'usuarios/:id/password',
        canActivate: [permissionGuard('manage-users')],
        title: 'Restablecer contraseña | CFA',
        loadComponent: () =>
          import('./features/users/pages/user-password').then((m) => m.UserPassword),
      },
      {
        path: 'acceso-denegado',
        title: 'Acceso restringido | CFA',
        loadComponent: () => import('./shared/ui/access-denied').then((m) => m.AccessDenied),
      },
      {
        path: '**',
        title: 'Página no encontrada | CFA',
        loadComponent: () => import('./shared/ui/not-found').then((m) => m.NotFound),
      },
    ],
  },
];
