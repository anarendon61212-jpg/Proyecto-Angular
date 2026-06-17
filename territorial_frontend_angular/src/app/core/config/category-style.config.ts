export interface CategoryStyleRule {
  label: string;
  description: string;
  icon: string;
  color: string;
  markerType: string;
  keywords: string[];
}

export interface CategorySeedDefinition {
  name: string;
  description: string;
  subcategories: Array<{ name: string; description: string }>;
}

export const CATEGORY_STYLE_RULES: CategoryStyleRule[] = [
  {
    label: 'Infraestructura',
    description: 'Vias, andenes y danos fisicos.',
    icon: 'cone',
    color: '#ef4444',
    markerType: 'infrastructure',
    keywords: ['infraestructura', 'via', 'calle', 'carretera', 'anden', 'hueco', 'pavimento']
  },
  {
    label: 'Movilidad',
    description: 'Transito y transporte publico.',
    icon: 'bus',
    color: '#3b82f6',
    markerType: 'mobility',
    keywords: ['movilidad', 'transito', 'trafico', 'bus', 'transporte', 'semaforo', 'senal']
  },
  {
    label: 'Seguridad',
    description: 'Riesgos de seguridad ciudadana.',
    icon: 'shield',
    color: '#7c3aed',
    markerType: 'security',
    keywords: ['seguridad', 'alarma', 'alerta', 'delito', 'policia', 'hurto', 'violencia']
  },
  {
    label: 'Salud',
    description: 'Eventos y alertas sanitarias.',
    icon: 'cross',
    color: '#22c55e',
    markerType: 'health',
    keywords: ['salud', 'hospital', 'medico', 'medicina', 'sanitario', 'epidemia']
  },
  {
    label: 'Educacion',
    description: 'Entorno educativo y acceso.',
    icon: 'book',
    color: '#0ea5e9',
    markerType: 'education',
    keywords: ['educacion', 'colegio', 'escuela', 'universidad', 'estudiante', 'docente']
  },
  {
    label: 'Espacio publico',
    description: 'Parques, mobiliario y uso comun.',
    icon: 'tree',
    color: '#16a34a',
    markerType: 'public-space',
    keywords: ['espacio publico', 'parque', 'mobiliario', 'plazoleta', 'zona verde']
  },
  {
    label: 'Medio ambiente',
    description: 'Residuos, flora y ecosistema.',
    icon: 'leaf',
    color: '#10b981',
    markerType: 'environment',
    keywords: ['medio ambiente', 'ambiental', 'residuo', 'basura', 'reciclaje', 'arbol', 'contaminacion']
  },
  {
    label: 'Comercio',
    description: 'Actividad comercial local.',
    icon: 'store',
    color: '#f97316',
    markerType: 'commerce',
    keywords: ['comercio', 'tienda', 'negocio', 'venta', 'mercado', 'vendedor']
  },
  {
    label: 'Riesgo',
    description: 'Amenazas, emergencias o deslizamientos.',
    icon: 'alert',
    color: '#dc2626',
    markerType: 'risk',
    keywords: ['riesgo', 'deslizamiento', 'incendio', 'emergencia', 'inundacion', 'derrumbe']
  },
  {
    label: 'Ruido',
    description: 'Contaminacion auditiva.',
    icon: 'sound',
    color: '#f59e0b',
    markerType: 'noise',
    keywords: ['ruido', 'sonido', 'contaminacion auditiva', 'escandalo']
  },
  {
    label: 'Alumbrado',
    description: 'Iluminacion y postes.',
    icon: 'light',
    color: '#eab308',
    markerType: 'lighting',
    keywords: ['alumbrado', 'luz', 'poste', 'iluminacion', 'luminaria']
  }
];

export const CATEGORY_SEED_DEFINITIONS: CategorySeedDefinition[] = [
  {
    name: 'Infraestructura',
    description: 'Vias, andenes y danos fisicos.',
    subcategories: [
      { name: 'Huecos en via', description: 'Deterioro del pavimento y craters en calles.' },
      { name: 'Andenes deteriorados', description: 'Andenes fracturados o con riesgo peatonal.' },
      { name: 'Senalizacion danada', description: 'Senas y avisos viales en mal estado.' }
    ]
  },
  {
    name: 'Movilidad',
    description: 'Transito y transporte publico.',
    subcategories: [
      { name: 'Congestion vial', description: 'Reportes de trancones y bloqueos.' },
      { name: 'Paraderos en mal estado', description: 'Paradas de bus deterioradas.' },
      { name: 'Semaforo fuera de servicio', description: 'Cruces sin control semaforico.' }
    ]
  },
  {
    name: 'Seguridad',
    description: 'Riesgos de seguridad ciudadana.',
    subcategories: [
      { name: 'Zona insegura', description: 'Puntos con reportes frecuentes de inseguridad.' },
      { name: 'Camara danada', description: 'Dispositivos de vigilancia fuera de servicio.' },
      { name: 'Incidente delictivo', description: 'Eventos de hurto o violencia.' }
    ]
  },
  {
    name: 'Salud',
    description: 'Eventos y alertas sanitarias.',
    subcategories: [
      { name: 'Foco de insalubridad', description: 'Acumulacion de residuos o vectores.' },
      { name: 'Riesgo epidemiologico', description: 'Posibles brotes o contagios en zona.' },
      { name: 'Servicio medico insuficiente', description: 'Fallas de acceso a atencion en salud.' }
    ]
  },
  {
    name: 'Educacion',
    description: 'Entorno educativo y acceso.',
    subcategories: [
      { name: 'Infraestructura escolar', description: 'Danos en aulas o instalaciones.' },
      { name: 'Riesgo en entorno escolar', description: 'Amenazas en accesos escolares.' },
      { name: 'Acceso educativo', description: 'Barreras para ingreso y permanencia.' }
    ]
  },
  {
    name: 'Espacio publico',
    description: 'Parques, mobiliario y uso comun.',
    subcategories: [
      { name: 'Parque deteriorado', description: 'Juegos o mobiliario en mal estado.' },
      { name: 'Uso indebido de espacio', description: 'Ocupacion no autorizada de areas comunes.' },
      { name: 'Limpieza de espacio publico', description: 'Necesidad de mantenimiento general.' }
    ]
  },
  {
    name: 'Medio ambiente',
    description: 'Residuos, flora y ecosistema.',
    subcategories: [
      { name: 'Basurero a cielo abierto', description: 'Acumulacion irregular de residuos.' },
      { name: 'Contaminacion de agua', description: 'Afectacion de fuentes hidricas.' },
      { name: 'Arbolado en riesgo', description: 'Arboles caidos o con peligro.' }
    ]
  },
  {
    name: 'Comercio',
    description: 'Actividad comercial local.',
    subcategories: [
      { name: 'Comercio informal', description: 'Ventas no reguladas en espacio publico.' },
      { name: 'Establecimiento irregular', description: 'Locales con incumplimientos normativos.' },
      { name: 'Impacto comercial', description: 'Situaciones que afectan dinamica comercial.' }
    ]
  },
  {
    name: 'Riesgo',
    description: 'Amenazas, emergencias o deslizamientos.',
    subcategories: [
      { name: 'Deslizamiento', description: 'Inestabilidad del terreno.' },
      { name: 'Riesgo de inundacion', description: 'Sectores propensos a crecientes.' },
      { name: 'Incendio estructural', description: 'Emergencias por fuego en construcciones.' }
    ]
  },
  {
    name: 'Ruido',
    description: 'Contaminacion auditiva.',
    subcategories: [
      { name: 'Ruido nocturno', description: 'Exceso de ruido en horario nocturno.' },
      { name: 'Ruido industrial', description: 'Emisiones sonoras de actividad productiva.' },
      { name: 'Ruido de trafico', description: 'Niveles altos de ruido vehicular.' }
    ]
  },
  {
    name: 'Alumbrado',
    description: 'Iluminacion y postes.',
    subcategories: [
      { name: 'Luminaria apagada', description: 'Puntos de luz fuera de servicio.' },
      { name: 'Poste averiado', description: 'Postes inestables o danados.' },
      { name: 'Cobertura insuficiente', description: 'Zonas con baja iluminacion.' }
    ]
  }
];

