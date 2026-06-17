import { ChangeDetectionStrategy, Component } from '@angular/core';

interface DashboardComponentItem {
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
  readonly components: DashboardComponentItem[] = [
    {
      icon: 'MAP',
      title: 'Componente Espacial',
      description: 'Demarcar y visualizar el territorio mediante polígonos geoespaciales que definen departamentos, ciudades, comunas y barrios sobre un mapa interactivo.'
    },
    {
      icon: 'NOTE',
      title: 'Componente Social',
      description: 'Registrar anotaciones territoriales —reportes de ciudadanos y funcionarios— categorizadas, geolocalizadas y respaldadas con evidencia fotográfica.'
    },
    {
      icon: 'COMMUNITY',
      title: 'Componente Comunitario',
      description: 'Involucra activamente al ciudadano como agente de reporte y calificación, y a las entidades como partes interesadas en la gestión territorial.'
    }
  ];
}
