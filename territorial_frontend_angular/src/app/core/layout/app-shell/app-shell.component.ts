import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../auth/auth.service';
import { MAIN_NAVIGATION, NavigationItem } from '../../config/navigation.config';
import { TERRITORIAL_APP_CONFIG } from '../../config/territorial-app-config';
import { LoadingService } from '../../services/loading.service';
import { OfficialLocationService } from '../../services/official-location.service';
import { ToastContainerComponent } from '@shared/components/toast-container/toast-container.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

interface NavigationSection {
  label: NavigationItem['section'];
  items: NavigationItem[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ToastContainerComponent, ConfirmDialogComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly loadingService = inject(LoadingService);
  private readonly officialLocationService = inject(OfficialLocationService);
  private readonly config = inject(TERRITORIAL_APP_CONFIG);

  readonly appName = this.config.appName;
  readonly currentUser = this.authService.currentUser;
  readonly currentRole = this.authService.currentRole;
  readonly isLoading = this.loadingService.isLoading;
  readonly notificationCount = 3;

  constructor() {
    this.officialLocationService.bindSessionTracking();
  }

  readonly navigationSections = computed<NavigationSection[]>(() => {
    const currentRole = this.authService.currentRole();
    const visibleItems = MAIN_NAVIGATION.filter((item) => {
      return !item.roles?.length || Boolean(currentRole && item.roles.includes(currentRole));
    });

    return visibleItems.reduce<NavigationSection[]>((sections, item) => {
      const existingSection = sections.find((section) => section.label === item.section);

      if (existingSection) {
        existingSection.items.push(item);
        return sections;
      }

      return [
        ...sections,
        {
          label: item.section,
          items: [item]
        }
      ];
    }, []);
  });

  logout(): void {
    this.authService.logout();
  }
}
