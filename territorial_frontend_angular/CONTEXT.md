# CONTEXT.md — Territorial Frontend Angular

Documentación de arquitectura y casos de uso implementados.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Angular 21 (standalone components) |
| Mapa | Leaflet |
| Auth | MSAL (Microsoft Authentication Library) |
| Backend | Flask (`http://127.0.0.1:5000`), proxiado en dev vía `/api` |
| Estilos | SCSS global + estilos inline por componente |

---

## Estructura general

```
src/app/
├── core/
│   ├── api/               # CrudResourceService, territorial-crud.services.ts
│   ├── models/            # territorial.models.ts, auth.models.ts
│   ├── config/            # entity-config.ts, territorial-app-config.ts
│   └── utils/
├── features/
│   ├── annotations/       # AnnotationsListComponent (CU CRUD anotaciones)
│   ├── map/               # MapComponent (CU-12 y demarcación de barrios)
│   ├── categories/
│   ├── citizens/
│   ├── communes/
│   ├── entities/
│   ├── neighborhoods/
│   ├── officials/
│   └── reports/
└── shared/
    ├── components/        # GenericCrudFormComponent, FileUploadComponent, DataTableComponent
    └── services/          # ToastService, ConfirmDialogService
```

---

## CU-12 Registrar anotación georreferenciada

### Descripción

Permite que un usuario autenticado registre una anotación directamente desde el mapa haciendo clic sobre una ubicación. La anotación queda asociada al barrio correspondiente (si el punto cae dentro de uno), y es visible inmediatamente en el mapa sin recargar la página.

### Componente principal

**`src/app/features/map/map.component.ts`** — `MapComponent`

### Flujo principal (pasos implementados)

| Paso | Implementación |
|------|---------------|
| 1. Usuario hace clic en el mapa | `this.map.on('click', this.onAnnotationMapClick)` — activo solo cuando `isAnnotationMode === true` |
| 2. Sistema abre modal con coordenadas | `openAnnotationModal(latlng)` — abre `.ann-modal` con lat/lng precargados (read-only) |
| 3. Usuario ingresa descripción, categorías, entidades, fotos | Formulario reactivo `annotationForm` + `FileUploadComponent` |
| 4. Sistema asocia al barrio | `findNeighborhoodForPoint(lat, lng)` usando ray-casting point-in-polygon |
| 5. Usuario selecciona entidades interesadas | Checkboxes multiselect en el modal |
| 6. Sistema guarda y muestra en el mapa | `submitAnnotation()` + `refreshMapLayers()` |

### Flujo alternativo 4a

Si el punto cae fuera de cualquier barrio demarcado:
- `pendingNeighborhoodId === null`
- El modal muestra un banner naranja de advertencia: _"El punto seleccionado no pertenece a ningún barrio demarcado..."_
- El botón de submit cambia su texto a **"Guardar sin barrio"** (confirmación implícita)
- La anotación se crea con `id_neighborhood: undefined`

### Modo anotación

- Se activa/desactiva con el botón **"Registrar anotación"** en el sidebar
- Mutualmente exclusivo con el modo de demarcación de polígonos
- Mientras está activo: cursor del mapa cambia a `crosshair`
- Badge naranja en la leyenda del mapa indica modo activo

### Servicios utilizados

| Servicio | Endpoint | Uso |
|---------|---------|-----|
| `AnnotationCrudService` | `POST /api/annotations` | Crea la anotación |
| `PointCrudService` | `POST /api/points` | Crea el punto de mapa (point_type: 'annotation') |
| `AnnotationCategoryCrudService` | `POST /api/annotation-categories` | Vincula categorías |
| `InterestedPartyCrudService` | `POST /api/interested-parties` | Vincula entidades interesadas |
| `EvidenceCrudService` | `POST /api/evidences` (multipart) | Sube fotografías |
| `CategoryCrudService` | `GET /api/categories` | Carga opciones de categorías |
| `EntityCrudService` | `GET /api/entities` | Carga opciones de entidades |
| `CitizenCrudService` | `GET /api/citizens` | Carga lista de ciudadanos |

### Modelos involucrados

#### `Annotation` (payload enviado al backend)
```typescript
{
  id_neighborhood?: number;   // null si flujo 4a
  id_citizen: number;         // requerido
  description: string;        // requerido
  latitude: number;
  longitude: number;
  status: 'active';
}
```

#### `Point` (creado automáticamente tras crear la anotación)
```typescript
{
  point_type: 'annotation';
  id_annotation: number;
  id_neighborhood?: number;
  latitude: number;
  longitude: number;
}
```

#### `InterestedParty` (uno por entidad seleccionada)
```typescript
{ id_annotation: number; id_entity: number; }
```

#### `AnnotationCategory` (uno por categoría seleccionada)
```typescript
{ id_annotation: number; id_category: number; }
```

#### `Evidence` (uno por foto adjuntada)
```typescript
// FormData: id_annotation + file
// Estructura lista para múltiples fotos (bucle sobre this.annotationPhotoFiles)
```

### Detección de barrio — algoritmo

**Ray-casting point-in-polygon** implementado en `isPointInPolygon(lat, lng, coords)`.

Prioridad de búsqueda en `findNeighborhoodForPoint(lat, lng)`:
1. Polígonos cargados desde la API: `points` con `point_type === 'polygon'`, agrupados por `id_neighborhood`, ordenados por `order`
2. Fallback: `NEIGHBORHOOD_SHAPES` (polígonos hardcodeados para demo)

### Actualización del mapa tras guardar

1. Se ejecuta `forkJoin([pointTask, ...categoriesTasks, ...entitiesTasks, ...photosTasks])`
2. El primer resultado (`results[0]`) es el `Point` recién creado (con `id_point` real)
3. Se agrega al array `this.points = [...this.points, newPoint]`
4. Se llama `refreshMapLayers()` → re-renderiza `annotationLayer` con el nuevo marcador ámbar
5. **No se recarga la página**

### Capas de mapa dedicadas

| Layer | Variable | Contenido |
|-------|---------|-----------|
| `neighborhoodLayer` | `L.layerGroup()` | Polígonos de barrios |
| `annotationLayer` | `L.layerGroup()` | Marcadores ámbar de anotaciones (`point_type === 'annotation'`) |
| `pointLayer` | `L.layerGroup()` | Puntos genéricos (polygon, boundary) |
| `selectedNeighborhoodLayer` | `L.layerGroup()` | Resaltado de barrio seleccionado |
| `editingLayer` | `L.layerGroup()` | Marcadores editables durante demarcación |

### Validaciones

| Campo | Regla |
|-------|-------|
| `id_citizen` | Requerido |
| `description` | Requerido, no puede ser solo espacios |
| Coordenadas | `lat ∈ [-90, 90]`, `lng ∈ [-180, 180]` |
| Barrio | Opcional — flujo 4a permite guardar sin barrio |

### Dependencias entre entidades

```
Annotation
  ├── id_citizen      → Citizen
  ├── id_neighborhood → Neighborhood (opcional)
  ├── AnnotationCategory (N)   → Category
  ├── InterestedParty (N)      → Entity
  ├── Evidence (N)             → archivo de imagen
  └── Point (1)                → visible en mapa
```

---

## Patrones de arquitectura

### CrudResourceService

Clase base genérica en `src/app/core/api/crud-resource.service.ts`.  
Todos los servicios CRUD heredan de ella y solo declaran `resourcePath`.

```typescript
@Injectable({ providedIn: 'root' })
export class AnnotationCrudService extends CrudResourceService<Annotation, AnnotationPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.annotations; // 'annotations'
}
```

Métodos disponibles: `list`, `listCollection`, `search`, `getById`, `create`, `createForm`, `update`, `updateForm`, `delete`.

### GenericCrudFormComponent

Usado por: entidades, funcionarios, categorías, ciudadanos, comunas.  
**No** usado por: anotaciones (usan formulario custom), barrios (usan `NeighborhoodsFormComponent`).

### FileUploadComponent

`src/app/shared/components/file-upload/file-upload.component.ts`  
Inputs: `[multiple]`, `[accept]`, `[maxSizeMb]` (default 2).  
Outputs: `(filesSelected)` → `File[]`, `(invalidFiles)` → `string[]`.

### ToastService

`src/app/shared/services/toast.service.ts`  
Métodos: `.success()`, `.danger()`, `.warning()`, `.info()`.

---

## Rutas principales

| Ruta | Componente |
|------|-----------|
| `/mapa` | `MapComponent` |
| `/anotaciones` | `AnnotationsListComponent` |
| `/entidades` | `EntitiesListGenericComponent` |
| `/funcionarios` | `OfficialsListGenericComponent` |
| `/categorias` | `CategoriesListGenericComponent` |
| `/ciudadanos` | `CitizensListGenericComponent` |
| `/comunas` | `CommunesListGenericComponent` |
| `/barrios` | `NeighborhoodsListComponent` |
| `/reportes` | `ReportsComponent` |
| `/dashboard` | `DashboardComponent` |

---

## Variables de entorno

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  appConfig: {
    apiBaseUrl: '/api',
    backendHealthUrl: '/health'
  }
};
```

Dev proxy (`proxy.conf.cjs`): `/api` → `http://127.0.0.1:5000/api`
