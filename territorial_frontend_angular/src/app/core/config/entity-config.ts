import { ValidatorFn, Validators } from '@angular/forms';
 
export interface EntityFieldConfig {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'file' | 'number' | 'textarea';
  required: boolean;
  placeholder?: string;
  minLength?: number;
  pattern?: string;
  options?: { label: string; value: string | number }[];
  validators?: ValidatorFn[];
  hint?: string;
}
 
export interface EntityTableColumn {
  key: string;
  header: string;
  width?: string;
  emptyValue?: string;
}
 
export interface DependencyCheck {
  service: string;
  endpoint: string;
  paramField: string;
  warningMessage: string;
}

export interface CascadingSelectConfig {
  sourceField: string;
  targetField: string;
  filterField: string;
}
 
export interface EntityConfig {
  name: string;
  apiPath: string;
  label: string;
  labelPlural: string;
  idField: string;
  hasFile: boolean;
  fileField?: string;
  searchEndpoint?: string;
  dependencyCheck?: DependencyCheck;
  dependencyChecks?: DependencyCheck[];
  cascadingSelects?: CascadingSelectConfig[];
  /**
   * CU-02 FIX 1: Cuando la unicidad del recurso NO es por "name" sino por otro campo
   * (ej: Officials se valida por "email"), se puede omitir la comprobación previa de
   * duplicado por nombre. El backend siempre es la fuente definitiva de verdad —
   * si hay duplicado, devuelve HTTP 400 y generic-crud-form lo muestra en el banner.
   */
  skipDuplicateCheck?: boolean;
  unsupportedFieldFallback?: {
    fields: string[];
    warningMessage: string;
  };
  columns: EntityTableColumn[];
  fields: EntityFieldConfig[];
}
 
export const buildValidators = (field: EntityFieldConfig): ValidatorFn[] => {
  const validators: ValidatorFn[] = [];
 
  if (field.required) {
    validators.push(Validators.required);
  }
 
  if (field.minLength) {
    validators.push(Validators.minLength(field.minLength));
  }
 
  if (field.type === 'email') {
    validators.push(Validators.email);
  }
 
  if (field.pattern) {
    validators.push(Validators.pattern(field.pattern));
  }
 
  if (field.validators) {
    validators.push(...field.validators);
  }
 
  return validators;
};
 
export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  entities: {
    name: 'entities',
    apiPath: 'entities',
    label: 'Entidad',
    labelPlural: 'Entidades',
    idField: 'id_entity',
    hasFile: true,
    fileField: 'file',
    searchEndpoint: 'entities/search',
    dependencyChecks: [
      {
        service: 'OfficialCrudService',
        endpoint: 'officials',
        paramField: 'id_entity',
        warningMessage: 'Existen funcionarios asociados a esta entidad'
      },
      {
        service: 'InterestedPartyCrudService',
        endpoint: 'interested-parties',
        paramField: 'id_entity',
        warningMessage: 'Existen interesados asociados a esta entidad'
      }
    ],
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'nit', header: 'NIT' },
      { key: 'email', header: 'Correo' },
      { key: 'phone', header: 'Teléfono', emptyValue: '—' },
      { key: 'status', header: 'Estado' }
    ],
    fields: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        required: true,
        placeholder: 'Nombre de la entidad',
        minLength: 3
      },
      {
        key: 'nit',
        label: 'NIT',
        type: 'text',
        required: true,
        placeholder: '1234567890',
        pattern: '^[0-9]+$'
      },
      {
        key: 'email',
        label: 'Correo',
        type: 'email',
        required: true,
        placeholder: 'info@entidad.gov.co'
      },
      {
        key: 'phone',
        label: 'Teléfono',
        type: 'tel',
        required: false,
        placeholder: '+57 6 xxxx xxxx'
      },
      {
        key: 'address',
        label: 'Dirección',
        type: 'text',
        required: false,
        placeholder: 'Calle 10 # 15-45'
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        options: [
          { label: 'Activa', value: 'Activa' },
          { label: 'Inactiva', value: 'Inactiva' }
        ]
      },
      {
        key: 'file',
        label: 'Logo',
        type: 'file',
        required: false,
        hint: 'Arrastra el logo aquí o haz clic para seleccionar'
      }
    ]
  },
 
  officials: {
    name: 'officials',
    apiPath: 'officials',
    label: 'Funcionario',
    labelPlural: 'Funcionarios',
    idField: 'id_official',
    hasFile: false,
    searchEndpoint: 'officials/search',
    // CU-02 FIX 1: No hacer checkDuplicate por nombre. La unicidad en Officials
    // es por "email", no por "name". Si el email ya existe el backend responde
    // HTTP 400 y generic-crud-form.ts ya muestra el mensaje en el banner (FIX 2 del form).
    skipDuplicateCheck: true,
    // NOTA CU-02 E3 (eliminar): El modelo Annotation del backend NO tiene campo id_official,
    // por lo que no es posible verificar dependencias vía search antes de eliminar.
    // El propio backend bloquea el DELETE con HTTP 400 si hay una FK violation en BD
    // y el interceptor muestra ese mensaje en el toast. No se define dependencyChecks aquí.
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'email', header: 'Correo' },
      { key: 'phone', header: 'Teléfono', emptyValue: '—' },
      { key: 'role', header: 'Rol' },
      { key: 'status', header: 'Estado' }
    ],
    fields: [
      {
        key: 'name',
        label: 'Nombre Completo',
        type: 'text',
        required: true,
        placeholder: 'Juan Pérez García',
        minLength: 3
      },
      {
        key: 'email',
        label: 'Correo',
        type: 'email',
        required: true,
        placeholder: 'juan.perez@manizales.gov.co'
        // CU-02 FIX 1: La validación de email único la maneja el backend (HTTP 400).
        // El generic-crud-form.ts ya captura el mensaje del interceptor y lo muestra
        // en el banner del formulario (duplicateError). No se necesita checkDuplicate
        // por nombre aquí — el email se valida al hacer POST/PUT.
      },
      {
        key: 'phone',
        label: 'Celular',
        type: 'tel',
        required: false,
        placeholder: '+57 3xx xxx xxxx'
      },
      {
        key: 'role',
        label: 'Cargo / Rol',
        type: 'text',
        required: true,
        placeholder: 'Ej: Inspector, Gestor territorial',
        minLength: 2
      },
      {
        key: 'id_entity',
        label: 'Entidad',
        type: 'select',
        required: true,
        options: [], // Llenado dinámicamente en OfficialsListGenericComponent
        hint: 'Selecciona la entidad a la que pertenece el funcionario'
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        // CU-02 FIX 2: El backend exige "active" / "inactive" (minúscula inglés).
        // La ref. de respuestas confirma: gps_active tracking requiere status "active" o "activo".
        // Los valores anteriores "Activo"/"Inactivo" eran rechazados por el tracking del backend.
        options: [
          { label: 'Activo', value: 'active' },
          { label: 'Inactivo', value: 'inactive' }
        ]
      }
    ]
  },
 
  citizens: {
    name: 'citizens',
    apiPath: 'citizens',
    label: 'Ciudadano',
    labelPlural: 'Ciudadanos',
    idField: 'id_citizen',
    hasFile: false,
    searchEndpoint: 'citizens/search',
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'email', header: 'Correo' },
      { key: 'phone', header: 'Teléfono', emptyValue: '—' },
      { key: 'status', header: 'Estado' }
    ],
    fields: [
      {
        key: 'name',
        label: 'Nombre Completo',
        type: 'text',
        required: true,
        placeholder: 'María Gómez López',
        minLength: 3
      },
      {
        key: 'email',
        label: 'Correo',
        type: 'email',
        required: true,
        placeholder: 'maria@email.com'
      },
      {
        key: 'phone',
        label: 'Teléfono',
        type: 'tel',
        required: false,
        placeholder: '+57 3xx xxx xxxx'
      },
      {
        key: 'address',
        label: 'Dirección',
        type: 'text',
        required: false,
        placeholder: 'Carrera 5 # 22-10'
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        options: [
          { label: 'Activo', value: 'Activo' },
          { label: 'Inactivo', value: 'Inactivo' }
        ]
      }
    ]
  },
 
  categories: {
    name: 'categories',
    apiPath: 'categories',
    label: 'Categoría',
    labelPlural: 'Categorías',
    idField: 'id_category',
    hasFile: true,
    fileField: 'file',
    searchEndpoint: 'categories/search',
    dependencyChecks: [
      {
        service: 'CategoryCrudService',
        endpoint: 'categories',
        paramField: 'id_parent_category',
        warningMessage: 'Existen subcategorías asociadas a esta categoría'
      },
      {
        service: 'AnnotationCategoryCrudService',
        endpoint: 'annotation-categories',
        paramField: 'id_category',
        warningMessage: 'Existen anotaciones asociadas a esta categoría'
      }
    ],
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'id_parent_category', header: 'Categoría Padre', emptyValue: '—' },
      { key: 'description', header: 'Descripción', emptyValue: '—' },
      { key: 'status', header: 'Estado' }
    ],
    fields: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        required: true,
        placeholder: 'Ej: Agua potable, Vías públicas',
        minLength: 3
      },
      {
        key: 'id_parent_category',
        label: 'Categoría Padre',
        type: 'select',
        required: false,
        options: [], // Será llenado dinámicamente
        hint: 'Selecciona una categoría padre para crear una subcategoría'
      },
      {
        key: 'description',
        label: 'Descripción',
        type: 'textarea',
        required: false,
        placeholder: 'Descripción detallada de la categoría'
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        options: [
          { label: 'Activa', value: 'Activa' },
          { label: 'Inactiva', value: 'Inactiva' }
        ]
      },
      {
        key: 'file',
        label: 'Imagen',
        type: 'file',
        required: false,
        hint: 'Arrastra la imagen aquí o haz clic para seleccionar'
      }
    ]
  },
 
  communes: {
    name: 'communes',
    apiPath: 'communes',
    label: 'Comuna',
    labelPlural: 'Comunas',
    idField: 'id_commune',
    hasFile: false,
    searchEndpoint: 'communes/search',
    dependencyChecks: [
      {
        service: 'NeighborhoodCrudService',
        endpoint: 'neighborhoods',
        paramField: 'id_commune',
        warningMessage: 'Existen barrios asociados a esta comuna'
      }
    ],
    cascadingSelects: [
      {
        sourceField: 'id_department',
        targetField: 'id_city',
        filterField: 'id_department'
      }
    ],
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'id_department', header: 'Departamento', emptyValue: '—' },
      { key: 'id_city', header: 'Ciudad', emptyValue: '—' },
      { key: 'status', header: 'Estado' }
    ],
    fields: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        required: true,
        placeholder: 'Ej: Comuna Centro, Comuna Arboleda',
        minLength: 3
      },
      {
        key: 'id_department',
        label: 'Departamento',
        type: 'select',
        required: true,
        options: [] // Será llenado dinámicamente
      },
      {
        key: 'id_city',
        label: 'Ciudad',
        type: 'select',
        required: true,
        options: [] // Será llenado dinámicamente
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        options: [
          { label: 'Activa', value: 'Activa' },
          { label: 'Inactiva', value: 'Inactiva' }
        ]
      }
    ]
  },
 
  neighborhoods: {
    name: 'neighborhoods',
    apiPath: 'neighborhoods',
    label: 'Barrio',
    labelPlural: 'Barrios',
    idField: 'id_neighborhood',
    hasFile: false,
    searchEndpoint: 'neighborhoods/search',
    dependencyChecks: [
      {
        service: 'PointCrudService',
        endpoint: 'points',
        paramField: 'id_neighborhood',
        warningMessage: 'Existen puntos asociados a este barrio'
      },
      {
        service: 'AnnotationCrudService',
        endpoint: 'annotations',
        paramField: 'id_neighborhood',
        warningMessage: 'Existen anotaciones asociadas a este barrio'
      }
    ],
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'id_commune', header: 'Comuna', emptyValue: '—' },
      { key: 'status', header: 'Estado' }
    ],
    fields: [
      {
        key: 'name',
        label: 'Nombre',
        type: 'text',
        required: true,
        placeholder: 'Ej: Versalles, Palermo, Minitas',
        minLength: 3
      },
      {
        key: 'id_commune',
        label: 'Comuna',
        type: 'select',
        required: true,
        options: [] // Será llenado dinámicamente
      },
      {
        key: 'status',
        label: 'Estado',
        type: 'select',
        required: true,
        options: [
          { label: 'Activa', value: 'Activa' },
          { label: 'Inactiva', value: 'Inactiva' }
        ]
      }
    ]
  }
};
 
export function getEntityConfig(entityName: string): EntityConfig {
  const config = ENTITY_CONFIGS[entityName];
  if (!config) {
    throw new Error(`Entity configuration not found for: ${entityName}`);
  }
  return config;
}