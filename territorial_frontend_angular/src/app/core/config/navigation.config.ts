import { UserRole } from '../models/auth.models';

export interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  section: 'Principal' | 'Gestión territorial' | 'Administración';
  roles?: UserRole[];
}

export const MAIN_NAVIGATION: NavigationItem[] = [
  {
    label: 'Inicio',
    icon: '⌂',
    route: '/dashboard',
    section: 'Principal'
  },
  {
    label: 'Mapa',
    icon: '▱',
    route: '/mapa',
    section: 'Principal'
  },
  {
    label: 'Anotaciones',
    icon: '✎',
    route: '/anotaciones',
    section: 'Principal'
  },
  {
    label: 'Reportes',
    icon: '▣',
    route: '/reportes',
    section: 'Principal',
    roles: ['Administrador', 'Funcionario']
  },
  {
    label: 'Estadísticas',
    icon: '📊',
    route: '/estadisticas',
    section: 'Principal',
    roles: ['Administrador', 'Funcionario']
  },
  {
    label: 'Comunas',
    icon: '⌂',
    route: '/territorios/comunas',
    section: 'Gestión territorial',
    roles: ['Administrador', 'Funcionario']
  },
  {
    label: 'Barrios',
    icon: '▦',
    route: '/territorios/barrios',
    section: 'Gestión territorial',
    roles: ['Administrador', 'Funcionario']
  },
  {
    label: 'Demarcación',
    icon: '⌖',
    route: '/territorios/demarcacion',
    section: 'Gestión territorial',
    roles: ['Administrador', 'Funcionario']
  },
  {
    label: 'Entidades',
    icon: '▥',
    route: '/admin/entidades',
    section: 'Administración',
    roles: ['Administrador']
  },
  {
    label: 'Funcionarios',
    icon: '♙',
    route: '/admin/funcionarios',
    section: 'Administración',
    roles: ['Administrador']
  },
  {
    label: 'Ciudadanos',
    icon: '♙',
    route: '/admin/ciudadanos',
    section: 'Administración',
    roles: ['Administrador']
  },
  {
    label: 'Categorías',
    icon: '⌘',
    route: '/admin/categorias',
    section: 'Administración',
    roles: ['Administrador']
  },
  {
    label: 'Configuración',
    icon: '⚙',
    route: '/configuracion',
    section: 'Administración'
  }
];
