# PLAN DE MIGRACIÓN INCREMENTAL — VALIDACIÓN POR MÓDULO

## MÓDULO 1: OFFICIALS

### Análisis del Componente Específico

**Archivo:** `src/app/features/officials/officials-list.component.ts`

```typescript
@Component({
  selector: 'app-officials-list',
  standalone: true,
  imports: [CommonModule, DataTableComponent, PaginatorComponent],
  template: `...`
})
export class OfficialsListComponent {
  private readonly service = inject(OfficialCrudService);
  readonly collection$: Observable<any> = this.service.listCollection();
  readonly columns: DataTableColumn[] = [
    { key: 'id_official', header: 'ID' },
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Email' }
  ];
}
```

### Características Específicas

- ✅ Listado simple (sin crear/editar/eliminar)
- ✅ Paginación
- ✅ Búsqueda (a través del endpoint)
- ❌ Sin formulario
- ❌ Sin upload
- ❌ Sin acciones inline

### Configuración en entity-config.ts

**Presente:** Sí
**Completa:** ✅ Campos + Columnas + Validaciones

```javascript
officials: {
  name: 'officials',
  apiPath: 'officials',
  label: 'Funcionario',
  labelPlural: 'Funcionarios',
  idField: 'id_official',
  hasFile: false,
  searchEndpoint: 'officials/search',
  columns: [
    { key: 'name', header: 'Nombre' },
    { key: 'email', header: 'Correo' },
    { key: 'phone', header: 'Teléfono', emptyValue: '—' },
    { key: 'role', header: 'Rol' },
    { key: 'status', header: 'Estado' }
  ],
  fields: [...]
}
```

### Requisitos de Paridad

- [ ] Mostrar tabla con datos
- [ ] Paginación funcional
- [ ] Búsqueda en la API
- [ ] Crear funcionario (nuevo en genérico)
- [ ] Editar funcionario (nuevo en genérico)
- [ ] Eliminar funcionario (nuevo en genérico)
- [ ] Drawer panel (nuevo en genérico)
- [ ] Validaciones (en genérico)

### Diferencias Esperadas

**NOTA:** El genérico AÑADE funcionalidades no presentes en el original:
- Formulario con validaciones
- Crear/Editar/Eliminar acciones
- Drawer panel interactivo

**OBJETIVO:** Mantener listado + paginación IDÉNTICO, agregar CRUD.

### Riesgos Identificados

1. **Officials tiene relación con Entities** (`id_entity` es required)
   - Necesita dropdown dinámico de entidades
   - ¿entity-config lo configura? ❓ VERIFICAR

2. **Campos opcionales/requeridos en formulario**
   - Field `id_entity` tiene `options: []` (llenado dinámico)
   - ¿GenericCrudFormComponent puede llenar dinámicamente? ❓ VERIFICAR

---

## CHECKLIST PRE-MIGRACIÓN

- [ ] ¿Compilación actual limpia?
- [ ] ¿officials-list-generic creado?
- [ ] ¿Ruta en app.routes.ts apunta a genérico?
- [ ] ¿entity-config completo?
- [ ] ¿GenericCrudFormComponent soporta selectores dinámicos?
- [ ] ¿Hay diferencias no documentadas?

---

**Siguiente paso:** Verificación en vivo (compilación, imports, tipos)
