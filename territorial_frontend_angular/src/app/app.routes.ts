import { Routes } from '@angular/router';

import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'auth/login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login.component').then((component) => component.LoginComponent)
  },
  {
    path: 'auth/oauth/github/callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback.component').then((component) => component.OAuthCallbackComponent)
  },
  {
    path: 'auth/oauth/google/callback',
    loadComponent: () =>
      import('./features/auth/oauth-callback.component').then((component) => component.OAuthCallbackComponent)
  },
  {
    path: 'auth/completar-perfil',
    loadComponent: () =>
      import('./features/auth/complete-profile.component').then((component) => component.CompleteProfileComponent)
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((component) => component.DashboardComponent)
      },
      {
        path: 'mapa',
        loadComponent: () => import('./features/map/map.component').then((component) => component.MapComponent)
      },
      {
        path: 'anotaciones',
        loadComponent: () => import('./features/annotations/annotations-list.component').then((component) => component.AnnotationsListComponent)
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/reports/reports.component').then((component) => component.ReportsComponent)
      },
      // 👇 AQUÍ AGREGAMOS LA NUEVA RUTA PARA TU GRÁFICA 👇
      {
        path: 'estadisticas',
        loadComponent: () => import('./gemini-chart/gemini-chart').then((c) => c.GeminiChartComponent)
      },
      // 👆 --------------------------------------------- 👆
      {
        path: 'admin/entidades',
        loadComponent: () => import('./features/entities/entities-list-generic.component').then((c) => c.EntitiesListGenericComponent)
      },
      {
        path: 'admin/funcionarios',
        loadComponent: () => import('./features/officials/officials-list-generic.component').then((c) => c.OfficialsListGenericComponent)
      },
      {
        path: 'admin/ciudadanos',
        loadComponent: () => import('./features/citizens/citizens-management.component').then((c) => c.CitizensManagementComponent)
      },
      {
        path: 'admin/categorias',
        loadComponent: () => import('./features/categories/categories-list-generic.component').then((c) => c.CategoriesListGenericComponent)
      },
      {
        path: 'territorios/comunas',
        loadComponent: () => import('./features/communes/communes-list.component').then((c) => c.CommunesListComponent)
      },
      {
        path: 'territorios/barrios',
        loadComponent: () => import('./features/neighborhoods/neighborhoods-list.component').then((c) => c.NeighborhoodsListComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
