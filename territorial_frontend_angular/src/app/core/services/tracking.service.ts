import { Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

import { TERRITORIAL_APP_CONFIG } from '../config/territorial-app-config';
import { OfficialTracking, TrackingPayload } from '../models/territorial.models';

@Injectable({ providedIn: 'root' })
export class TrackingService implements OnDestroy {
  private readonly config = inject(TERRITORIAL_APP_CONFIG);
  private readonly trackingSubject = new Subject<TrackingPayload>();
  private readonly statusSubject = new Subject<'connected' | 'disconnected' | 'error'>();
  private socket: Socket | null = null;
  private listening = false;

  listenTracking(): Observable<TrackingPayload> {
    this.ensureSocket();
    return this.trackingSubject.asObservable();
  }

  connectionStatus$(): Observable<'connected' | 'disconnected' | 'error'> {
    this.ensureSocket();
    return this.statusSubject.asObservable();
  }

  ngOnDestroy(): void {
    this.cleanupListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.listening = false;
  }

  private ensureSocket(): void {
    if (!this.socket) {
      const normalizedBasePath = this.config.apiBaseUrl.replace(/\/$/, '');
      this.socket = io(this.config.apiBaseUrl, {
        path: `${normalizedBasePath}/socket.io`,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });
    }

    if (!this.listening && this.socket) {
      this.socket.on('connect', () => {
        this.statusSubject.next('connected');
      });

      this.socket.on('disconnect', () => {
        this.statusSubject.next('disconnected');
      });

      this.socket.on('connect_error', () => {
        this.statusSubject.next('error');
      });

      this.socket.on('error', () => {
        this.statusSubject.next('error');
      });

      this.socket.on('official_tracking', (payload: unknown) => {
        const normalizedPayload = this.normalizePayload(payload);
        if (normalizedPayload) {
          this.trackingSubject.next(normalizedPayload);
        }
      });

      this.listening = true;
    }
  }

  private cleanupListeners(): void {
    if (!this.socket) return;
    this.socket.off('connect');
    this.socket.off('disconnect');
    this.socket.off('connect_error');
    this.socket.off('error');
    this.socket.off('official_tracking');
  }

  private normalizePayload(payload: unknown): TrackingPayload | null {
    if (Array.isArray(payload)) {
      const officials = payload.filter((item): item is OfficialTracking => this.isOfficialTracking(item));
      return { officials };
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const candidate = payload as Partial<TrackingPayload> & { official?: unknown };

    if (Array.isArray(candidate.officials)) {
      const officials = candidate.officials.filter((item): item is OfficialTracking => this.isOfficialTracking(item));
      return { officials };
    }

    if (this.isOfficialTracking(candidate.official)) {
      return { officials: [candidate.official] };
    }

    return null;
  }

  private isOfficialTracking(value: unknown): value is OfficialTracking {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return typeof candidate['id_official'] === 'number'
      && typeof candidate['latitude'] === 'number'
      && typeof candidate['longitude'] === 'number';
  }
}
