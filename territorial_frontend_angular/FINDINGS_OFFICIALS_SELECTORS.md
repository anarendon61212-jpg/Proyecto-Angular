# HALLAZGO CRÍTICO — Officials requiere opciones dinámicas

## Problema Identificado

El campo `id_entity` en Officials tiene `options: []` que debe llenarse dinámicamente desde la API.

```typescript
{
  key: 'id_entity',
  label: 'Entidad',
  type: 'select',
  required: true,
  options: [] // ← VACÍO — debe llenar desde API
}
```

## Estado Actual

**GenericCrudListComponent:**
- ✅ Tiene signal `selectOptions = signal<Record<string, any[]>>({})`
- ❌ NO llena las opciones dinámicamente
- ✅ Las pasa al formulario correctamente

**GenericCrudFormComponent:**
- ✅ Acepta `[selectOptions]`
- ✅ Las usa en dropdowns
- ❌ No carga desde API

## Solución Elegida

**NO modificar GenericCrudListComponent** (podría romper otros módulos).

**EXTENDER officials-list-generic.component.ts** para:
1. Cargar entidades al inicializar
2. Llenar selectOptions antes de abrir el formulario
3. Mantener composición limpia

## Implementación

Actualizar `officials-list-generic.component.ts`:

```typescript
export class OfficialsListGenericComponent extends GenericCrudListComponent {
  readonly entityService = inject(EntityCrudService);

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadSelectOptions();
  }

  private loadSelectOptions(): void {
    this.entityService.list().pipe(take(1)).subscribe(entities => {
      const items = Array.isArray(entities) ? entities : entities.items || [];
      this.selectOptions.set({
        id_entity: items.map(e => ({
          label: e.name,
          value: e.id_entity
        }))
      });
    });
  }
}
```

Este enfoque:
- ✅ NO toca GenericCrudListComponent
- ✅ NO toca entity-config
- ✅ Mantiene extensibilidad
- ✅ Permite que otros módulos ignoren selectOptions
- ✅ Pattern reutilizable para selectores dependientes
