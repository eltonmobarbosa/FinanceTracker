import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse } from './models';

const STORAGE_KEY = 'financetracker.session';

/**
 * Holds the JWT. Kept in localStorage so a page refresh keeps the user logged in
 * (trade-off vs. an httpOnly cookie is documented in ADR 0007).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<AuthResponse | null>(readStoredSession());

  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly email = computed(() => this.session()?.email ?? '');

  /** The token, or null when absent or expired. */
  token(): string | null {
    const session = this.session();
    if (!session) return null;
    if (new Date(session.expiresAt) <= new Date()) {
      this.clear();
      return null;
    }
    return session.accessToken;
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(tap((r) => this.store(r)));
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { email, password }).pipe(tap((r) => this.store(r)));
  }

  logout(): void {
    this.clear();
    this.router.navigate(['/login']);
  }

  private store(session: AuthResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  private clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.session.set(null);
  }
}

function readStoredSession(): AuthResponse | null {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AuthResponse | null;
    return session && new Date(session.expiresAt) > new Date() ? session : null;
  } catch {
    return null;
  }
}
