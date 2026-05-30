import { ChangeDetectionStrategy, Component } from '@angular/core';

interface DashboardChecklistItem {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  readonly checklist: DashboardChecklistItem[] = [
    {
      icon: '🧭',
      title: 'Routing standalone',
      description: 'Estructura base para cargar módulos funcionales por rutas.'
    },
    {
      icon: '🛡️',
      title: 'Core de seguridad',
      description: 'Auth local, guards por sesión y roles, token en localStorage.'
    },
    {
      icon: '🔌',
      title: 'Cliente API',
      description: 'Wrapper HTTP listo para CRUD, paginación, búsqueda y uploads.'
    }
  ];
}
