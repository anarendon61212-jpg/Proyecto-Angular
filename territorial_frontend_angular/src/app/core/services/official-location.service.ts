import { EffectRef, Injectable, Injector, OnDestroy, effect, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { EntityCrudService, OfficialCrudService } from '../api/territorial-crud.services';
import { AuthService } from '../auth/auth.service';
import { Official, OfficialCreatePayload, OfficialPayload } from '../models/territorial.models';
import { ToastService } from '../../shared/services/toast.service';
import { TrackingService } from './tracking.service';

@Injectable({ providedIn: 'root' })
export class OfficialLocationService implements OnDestroy {
  private readonly injector = inject(Injector);
  private readonly authService = inject(AuthService);
  private readonly officialService = inject(OfficialCrudService);
  private readonly entityService = inject(EntityCrudService);
  private readonly toastService = inject(ToastService);
  private readonly trackingService = inject(TrackingService);

  private sessionEffect: EffectRef | null = null;
  private resolveOfficialSubscription: Subscription | null = null;
  private updateSubscription: Subscription | null = null;
  private createSubscription: Subscription | null = null;
  private watchId: number | null = null;
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private geoPermissionNotified = false;
  private geoPermissionPromptNotified = false;

  private activeOfficialEmail: string | null = null;
  private activeOfficialId: number | null = null;
  private lastSentLatitude: number | null = null;
  private lastSentLongitude: number | null = null;
  private lastSentTimestamp = 0;

  private readonly minSendIntervalMs = 3_000;
  private readonly minMoveDistanceMeters = 3;

  bindSessionTracking(): void {
    if (this.sessionEffect) {
      return;
    }

    this.sessionEffect = effect(() => {
      const role = this.authService.currentRole();
      const user = this.authService.currentUser();
      const email = (user?.email ?? '').trim().toLowerCase();

      if (role !== 'Funcionario' || !email) {
        this.stopTracking();
        return;
      }

      this.ensureTrackingForOfficial(email);
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.stopTracking();
    this.sessionEffect?.destroy();
    this.sessionEffect = null;
  }

  private ensureTrackingForOfficial(email: string): void {
    if (this.activeOfficialEmail === email && this.watchId != null && this.activeOfficialId != null) {
      return;
    }

    this.stopTracking();
    this.activeOfficialEmail = email;

    this.resolveOfficialSubscription = this.officialService.listCollection()
      .subscribe({
        next: (collection) => {
          const match = this.findOfficialByEmail(collection.items, email);
          if (!match) {
            this.ensureOfficialExistsForCurrentSession(email);
            return;
          }

          this.activeOfficialId = match.id_official;
          this.normalizeSessionOfficialGpsState(match);
          this.startGeolocationWatch();
        },
        error: () => {
          this.stopTracking();
        }
      });
  }

  private ensureOfficialExistsForCurrentSession(email: string): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.stopTracking();
      return;
    }

    this.createSubscription?.unsubscribe();
    this.createSubscription = this.entityService.listCollection()
      .subscribe({
        next: (entityCollection) => {
          if (entityCollection.items.length === 0) {
            this.stopTracking();
            return;
          }

          const preferredEntity = entityCollection.items.find((entity) => {
            return (entity.name ?? '').trim().toLowerCase() === (user.entityName ?? '').trim().toLowerCase();
          }) ?? entityCollection.items[0];

          const payload: OfficialCreatePayload = {
            id_entity: preferredEntity.id_entity,
            name: user.name || 'Funcionario OAuth',
            email,
            role: 'Funcionario',
            status: 'active',
            // New session-based officials start offline until first real GPS fix.
            gps_active: false
          };

          this.officialService.create(payload as OfficialPayload)
            .subscribe({
              next: (createdOfficial) => {
                this.activeOfficialId = createdOfficial.id_official;
                this.startGeolocationWatch();
              },
              error: () => {
                // If official already exists (race/duplicate), resolve again by email.
                this.resolveOfficialSubscription?.unsubscribe();
                this.resolveOfficialSubscription = this.officialService.listCollection()
                  .subscribe({
                    next: (officialCollection) => {
                      const existing = this.findOfficialByEmail(officialCollection.items, email);
                      if (!existing) {
                        this.stopTracking();
                        return;
                      }
                      this.activeOfficialId = existing.id_official;
                      this.startGeolocationWatch();
                    },
                    error: () => this.stopTracking()
                  });
              }
            });
        },
        error: () => {
          this.stopTracking();
        }
      });
  }

  private startGeolocationWatch(): void {
    if (!navigator?.geolocation) {
      this.toastService.warning(
        'Geolocalización no disponible',
        'Este navegador no soporta GPS para compartir ubicación en tiempo real.'
      );
      return;
    }

    if (this.watchId != null) {
      return;
    }

    console.group('[GPS] Inicio de seguimiento');
    console.log('URL:', location.href);
    console.log('Origin:', location.origin);
    console.log('Secure Context:', window.isSecureContext);
    console.log('Navigator Geolocation:', !!navigator.geolocation);
    console.log('User Agent:', navigator.userAgent);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();

    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          console.log('[GPS] Permission State:', result.state);
          if (result.state !== 'granted') {
            this.notifyLocationPermissionPrompt(result.state);
          }
        })
        .catch((error) => {
          console.error('[GPS] Permission Query Error:', error);
          this.notifyLocationPermissionPrompt('prompt');
        });
    } else {
      this.notifyLocationPermissionPrompt('prompt');
    }

    // Force an immediate GPS read so the map updates right after login.
    navigator.geolocation.getCurrentPosition(
      (position) => this.handlePositionUpdate(position, true),
      (error) => {
        console.error('[GPS] getCurrentPosition Error:', error);
        this.handleGeolocationError(error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 20_000
      }
    );

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePositionUpdate(position, true),
      (error) => this.handleGeolocationError(error),
      {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 20_000
      }
    );

    this.startHeartbeat();
  }

  private handlePositionUpdate(position: GeolocationPosition, force = false): void {
    console.group('[GPS] POSITION RECEIVED');
    console.log('Latitude:', position.coords.latitude);
    console.log('Longitude:', position.coords.longitude);
    console.log('Accuracy:', position.coords.accuracy);
    console.log('Timestamp:', new Date(position.timestamp).toISOString());
    console.groupEnd();

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    if (!force && !this.shouldSendLocation(latitude, longitude)) {
      return;
    }

    this.sendLocationUpdate({
      last_latitude: latitude,
      last_longitude: longitude,
      gps_active: true
    });

    this.lastSentLatitude = latitude;
    this.lastSentLongitude = longitude;
    this.lastSentTimestamp = Date.now();
  }

  private reportGpsInactive(): void {
    this.sendLocationUpdate({
      gps_active: false
    });
  }

  private handleGeolocationError(error: GeolocationPositionError): void {
    console.group('[GPS] ERROR');
    console.log('Code:', error.code);
    console.log('Message:', error.message);
    console.log('Secure Context:', window.isSecureContext);
    console.log('URL:', location.href);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();

    const errorName = {
      1: 'PERMISSION_DENIED',
      2: 'POSITION_UNAVAILABLE',
      3: 'TIMEOUT'
    }[error.code] ?? 'UNKNOWN_ERROR';

    console.error('[GPS] Error Type:', errorName);

    this.reportGpsInactive();
    if (this.geoPermissionNotified) {
      return;
    }
    this.geoPermissionNotified = true;
    this.toastService.warning(
      'No se pudo acceder al GPS del dispositivo',
      'Autoriza la ubicación en el navegador para compartir posición en tiempo real.'
    );
  }

  private notifyLocationPermissionPrompt(state: PermissionState = 'prompt'): void {
    if (this.geoPermissionPromptNotified) {
      return;
    }

    if (state === 'granted') {
      return;
    }

    this.geoPermissionPromptNotified = true;
    if (state === 'denied') {
      this.toastService.warning(
        'Permiso de ubicación requerido',
        'La ubicación está bloqueada. Habilítala en la configuración del navegador para activar GPS en tiempo real.'
      );
      return;
    }

    this.toastService.info(
      'Permiso de ubicación requerido',
      'Permite el acceso a la ubicación de este dispositivo para activar GPS en tiempo real.'
    );
  }

  private startHeartbeat(): void {
    if (this.heartbeatIntervalId != null) {
      return;
    }

    this.heartbeatIntervalId = setInterval(() => {
      if (
        this.activeOfficialId == null
        || this.lastSentLatitude == null
        || this.lastSentLongitude == null
      ) {
        return;
      }

      this.sendLocationUpdate({
        last_latitude: this.lastSentLatitude,
        last_longitude: this.lastSentLongitude,
        gps_active: true
      });
    }, 12_000);
  }

  private sendLocationUpdate(payload: Partial<Official>): void {
    if (this.activeOfficialId == null) {
      return;
    }

    if (payload.last_latitude != null && payload.last_longitude != null) {
      this.trackingService.emitLocationUpdate({
        id_official: this.activeOfficialId,
        latitude: payload.last_latitude,
        longitude: payload.last_longitude,
        lastUpdate: payload.last_gps_update ?? new Date().toISOString(),
        gps_active: payload.gps_active !== false
      });
    }

    this.updateSubscription?.unsubscribe();
    const officialId = this.activeOfficialId;
    console.group('[TRACKING UPDATE]');
    console.log('Official ID:', officialId);
    console.log('Payload:', payload);
    console.groupEnd();

    this.updateSubscription = this.officialService.update(officialId, payload).subscribe({
      error: (error: unknown) => {
        if (error && typeof error === 'object') {
          const candidate = error as {
            status?: unknown;
            statusText?: unknown;
            error?: unknown;
          };
          console.group('[TRACKING UPDATE ERROR]');
          console.log('error.status:', candidate.status);
          console.log('error.statusText:', candidate.statusText);
          console.log('error.error:', candidate.error);
          console.groupEnd();
        } else {
          console.error('[TRACKING UPDATE ERROR] Unknown error shape:', error);
        }
        // The tracking pipeline should be best-effort and never break UI flow.
      }
    });
  }

  private stopTracking(): void {
    // When the session closes, explicitly report GPS offline once
    // so the backend does not keep the official as active.
    this.reportGpsInactive();

    if (this.watchId != null && navigator?.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    if (this.heartbeatIntervalId != null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    this.resolveOfficialSubscription?.unsubscribe();
    this.resolveOfficialSubscription = null;
    this.updateSubscription?.unsubscribe();
    this.updateSubscription = null;
    this.createSubscription?.unsubscribe();
    this.createSubscription = null;

    this.activeOfficialEmail = null;
    this.activeOfficialId = null;
    this.lastSentLatitude = null;
    this.lastSentLongitude = null;
    this.lastSentTimestamp = 0;
    this.geoPermissionNotified = false;
    this.geoPermissionPromptNotified = false;
  }

  private shouldSendLocation(latitude: number, longitude: number): boolean {
    const now = Date.now();
    const elapsed = now - this.lastSentTimestamp;
    if (elapsed < this.minSendIntervalMs) {
      return false;
    }

    if (this.lastSentLatitude == null || this.lastSentLongitude == null) {
      return true;
    }

    const distanceMeters = this.calculateDistanceMeters(
      this.lastSentLatitude,
      this.lastSentLongitude,
      latitude,
      longitude
    );

    return distanceMeters >= this.minMoveDistanceMeters;
  }

  private normalizeSessionOfficialGpsState(official: Official): void {
    // For OAuth/session-based tracking, stale or missing GPS signal must not
    // remain shown as active until the next real position is received.
    if (official.gps_active !== true) {
      return;
    }

    if (this.isRecentGpsUpdate(official.last_gps_update)) {
      return;
    }

    this.sendLocationUpdate({ gps_active: false });
  }

  private findOfficialByEmail(officials: Official[], email: string): Official | undefined {
    return officials.find((official) => (official.email ?? '').trim().toLowerCase() === email);
  }

  private isRecentGpsUpdate(timestamp: string | null | undefined, maxAgeMs = 30_000): boolean {
    if (!timestamp) {
      return false;
    }
    const ts = new Date(timestamp).getTime();
    if (!Number.isFinite(ts)) {
      return false;
    }
    return (Date.now() - ts) <= maxAgeMs;
  }

  private calculateDistanceMeters(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): number {
    const earthRadiusMeters = 6_371_000;
    const dLat = this.degreesToRadians(toLat - fromLat);
    const dLng = this.degreesToRadians(toLng - fromLng);
    const lat1 = this.degreesToRadians(fromLat);
    const lat2 = this.degreesToRadians(toLat);

    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusMeters * c;
  }

  private degreesToRadians(value: number): number {
    return value * (Math.PI / 180);
  }
}
