# Plantilla base — Sistema de Valoración Territorial (Angular)

Esta plantilla te deja una base lista para construir el proyecto descrito (módulos administrativos, autenticación OAuth, mapa interactivo, anotaciones y reportes).

## 1) Crear el proyecto Angular (scaffold)

```bash
npx @angular/cli@latest new sistema-valoracion-territorial \
  --routing \
  --style=scss \
  --standalone=false
cd sistema-valoracion-territorial
```

## 2) Estructura sugerida

```text
src/app/
  core/
    auth/
    guards/
    interceptors/
    services/
  shared/
    components/
    directives/
    pipes/
    models/
  features/
    admin/
      entidades/
      funcionarios/
      ciudadanos/
      categorias/
      comunas/
      barrios/
    territorial/
      mapa/
      demarcacion/
      seguimiento/
    anotaciones/
      crear/
      calificar/
      filtros/
    reportes/
      chat/
      graficas/
  layouts/
    auth-layout/
    dashboard-layout/
```

## 3) Rutas base (plantilla)

```ts
// app-routing.module.ts
const routes: Routes = [
  { path: 'login', loadChildren: () => import('./core/auth/auth.module').then(m => m.AuthModule) },
  {
    path: '',
    canActivate: [AuthGuard],
    component: DashboardLayoutComponent,
    children: [
      { path: 'admin', loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule) },
      { path: 'territorial', loadChildren: () => import('./features/territorial/territorial.module').then(m => m.TerritorialModule) },
      { path: 'anotaciones', loadChildren: () => import('./features/anotaciones/anotaciones.module').then(m => m.AnotacionesModule) },
      { path: 'reportes', loadChildren: () => import('./features/reportes/reportes.module').then(m => m.ReportesModule) },
      { path: '', redirectTo: 'territorial', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '' }
];
```

## 4) Modelos mínimos (plantilla)

```ts
export interface Entidad {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: 'PUBLICA' | 'PRIVADA';
  nit: string;
  telefono: string;
  correo: string;
  direccion: string;
  estado: 'ACTIVA' | 'INACTIVA';
  logoUrl?: string;
}

export interface Funcionario {
  id: string;
  nombre: string;
  correo: string;
  cargo: string;
  rol: 'FUNCIONARIO' | 'ADMINISTRADOR';
  celular: string;
  entidadId: string;
}

export interface Ciudadano {
  id: string;
  nombre: string;
  correo: string;
  celular: string;
  direccion: string;
  lat: number;
  lng: number;
}

export interface Anotacion {
  id: string;
  descripcion: string;
  categoriaId: string;
  subcategoriaId?: string;
  lat: number;
  lng: number;
  barrioId?: string;
  evidencias: string[];
  entidadIds: string[];
  creadoPor: string;
  fecha: string;
}
```

## 5) Módulos funcionales que debes crear

- **Módulo 1 Administración**
  - Gestión de entidades, funcionarios, ciudadanos, categorías/subcategorías, comunas y barrios.
  - Validaciones de unicidad y restricciones por dependencias antes de eliminar.
- **Módulo 2 Autenticación**
  - Login OAuth (Google, Microsoft, GitHub), asignación de rol y cierre de sesión.
- **Módulo 3 Territorial**
  - Mapa interactivo, demarcación de barrios por polígonos, edición de puntos y seguimiento en tiempo real de funcionarios.
- **Módulo 4 Anotaciones**
  - Crear anotación geolocalizada con fotos, calificación ciudadana y filtros por categoría/subcategoría/territorio.
- **Módulo 5 Reportes inteligentes**
  - Chat en lenguaje natural y visualización en barra, barra agrupada, circular y líneas.

## 6) Librerías recomendadas

```bash
npm i leaflet @types/leaflet
npm i @angular/material @angular/cdk
npm i chart.js ng2-charts
npm i @abacritt/angularx-social-login
```

## 7) Checklist MVP

- [ ] CRUD de Módulo 1 con validaciones de negocio.
- [ ] OAuth + guards por rol.
- [ ] Mapa con demarcación de polígonos por barrio.
- [ ] Creación/calificación de anotaciones con filtros jerárquicos.
- [ ] Reportes por chat con visualización gráfica.

---

Si quieres, en el siguiente paso te puedo generar también el **esqueleto inicial de código** (módulos, componentes, rutas y servicios) para pegar directamente en tu proyecto Angular.
