import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="auth-screen">
      <form class="card auth-card" [formGroup]="form" (ngSubmit)="submit()">
        <h1 class="brand">Finance<span>Tracker</span></h1>
        <p class="muted">Importe o extrato do banco e veja para onde foi o seu dinheiro.</p>

        <div class="tabs" role="tablist">
          <button type="button" role="tab" [class.active]="mode() === 'login'" (click)="mode.set('login')">Entrar</button>
          <button type="button" role="tab" [class.active]="mode() === 'register'" (click)="mode.set('register')">Criar conta</button>
        </div>

        <label>
          E-mail
          <input type="email" formControlName="email" autocomplete="email" />
        </label>
        @if (form.controls.email.touched && form.controls.email.invalid) {
          <small class="field-error">Informe um e-mail válido.</small>
        }

        <label>
          Senha
          <input type="password" formControlName="password"
                 [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'" />
        </label>
        @if (form.controls.password.touched && form.controls.password.invalid) {
          <small class="field-error">A senha precisa ter pelo menos 8 caracteres.</small>
        }

        <button type="submit" [disabled]="busy()">
          {{ mode() === 'login' ? 'Entrar' : 'Criar conta' }}
        </button>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const request = this.mode() === 'login' ? this.auth.login(email, password) : this.auth.register(email, password);

    this.busy.set(true);
    // Errors are shown by the HTTP interceptor; here we only need to re-enable the button.
    request.subscribe({
      next: () => this.router.navigate([this.mode() === 'register' ? '/importar' : '/']),
      error: () => this.busy.set(false),
    });
  }
}
