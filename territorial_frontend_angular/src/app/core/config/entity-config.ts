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
      },
      {
        key: 'phone',
        label: 'Teléfono',
        type: 'tel',
        required: false,
        placeholder: '+57 6 xxxx xxxx'
      },
      {
        key: 'role',
        label: 'Rol',
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
        options: [] // Será llenado dinámicamente
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
    columns: [
      { key: 'name', header: 'Nombre' },
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
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'id_city', header: 'Ciudad' },
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
    columns: [
      { key: 'name', header: 'Nombre' },
      { key: 'id_commune', header: 'Comuna' },
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