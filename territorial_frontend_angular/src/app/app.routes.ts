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
      {
        path: 'admin/entidades',
        loadComponent: () => import('./features/entities/entities-list.component').then((c) => c.EntitiesListComponent)
      },
      {
        path: 'admin/funcionarios',
        loadComponent: () => import('./features/officials/officials-list.component').then((c) => c.OfficialsListComponent)
      },
      {
        path: 'admin/ciudadanos',
        loadComponent: () => import('./features/citizens/citizens-list.component').then((c) => c.CitizensListComponent)
      },
      {
        path: 'admin/categorias',
        loadComponent: () => import('./features/categories/categories-list.component').then((c) => c.CategoriesListComponent)
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
