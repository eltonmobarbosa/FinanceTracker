import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { Icon, IconName } from '../shared/icon';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'file-up', title: 'Importe o extrato', text: 'OFX de qualquer banco ou o CSV da fatura Nubank.' },
  { icon: 'sparkles', title: 'Categorização automática', text: 'Regras que aprendem com cada correção sua.' },
  { icon: 'dashboard', title: 'Veja para onde foi', text: 'Gastos por categoria e evolução mês a mês.' },
];

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Icon],
  template: `
    <div class="grid min-h-screen lg:grid-cols-2">
      <section class="relative hidden overflow-hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col">
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.25),transparent_55%)]"></div>
        <div class="relative flex items-center gap-2.5 font-semibold">
          <span class="grid size-8 place-items-center rounded-lg bg-white text-zinc-950"><app-icon name="piggy-bank" [size]="18" /></span>
          FinanceTracker
        </div>
        <!-- Decorative product preview (static data), like the auth pages of Stripe or Linear. -->
        <div class="relative my-auto w-full max-w-sm self-center rounded-xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur" aria-hidden="true">
          <p class="text-xs text-zinc-400">Gastos de outubro</p>
          <p class="mt-1 text-2xl font-semibold tabular">R$ 3.912,40</p>
          <ul class="mt-5 space-y-3 text-sm">
            @for (row of preview; track row.name) {
              <li>
                <div class="flex justify-between text-zinc-300"><span>{{ row.name }}</span><span class="tabular">{{ row.value }}</span></div>
                <div class="mt-1.5 h-1.5 rounded-full bg-white/10"><div class="h-full rounded-full" [style.width.%]="row.pct" [style.background]="row.color"></div></div>
              </li>
            }
          </ul>
        </div>

        <div class="relative max-w-md">
          <h1 class="text-4xl font-semibold tracking-tight">Entenda para onde vai o seu dinheiro.</h1>
          <ul class="mt-10 space-y-6">
            @for (f of features; track f.title) {
              <li class="flex gap-4">
                <span class="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15"><app-icon [name]="f.icon" [size]="18" /></span>
                <div>
                  <p class="font-medium">{{ f.title }}</p>
                  <p class="text-sm text-zinc-400">{{ f.text }}</p>
                </div>
              </li>
            }
          </ul>
        </div>
      </section>

      <section class="flex items-center justify-center p-6">
        <form class="w-full max-w-sm" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="mb-8 flex items-center gap-2.5 font-semibold lg:hidden">
            <span class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><app-icon name="piggy-bank" [size]="18" /></span>
            FinanceTracker
          </div>

          <h2 class="text-2xl font-semibold tracking-tight">{{ mode() === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta' }}</h2>
          <p class="mt-1.5 text-sm text-muted-foreground">
            {{ mode() === 'login' ? 'Entre com seu e-mail e senha.' : 'Leva menos de um minuto. Categorias prontas incluídas.' }}
          </p>

          <div class="segmented mt-6 grid w-full grid-cols-2" role="group" aria-label="Entrar ou criar conta">
            <button type="button" [attr.aria-pressed]="mode() === 'login'" (click)="mode.set('login')">Entrar</button>
            <button type="button" [attr.aria-pressed]="mode() === 'register'" (click)="mode.set('register')">Criar conta</button>
          </div>

          <div class="mt-6 space-y-4">
            <div class="space-y-2">
              <label class="label" for="email">E-mail</label>
              <input id="email" class="input" type="email" formControlName="email" autocomplete="email" placeholder="voce@email.com"
                     [attr.aria-invalid]="showError('email')" />
              @if (showError('email')) { <p class="text-sm text-destructive">Informe um e-mail válido.</p> }
            </div>

            <div class="space-y-2">
              <label class="label" for="password">Senha</label>
              <div class="relative">
                <input id="password" class="input pr-10" [type]="showPassword() ? 'text' : 'password'" formControlName="password"
                       [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                       [attr.aria-invalid]="showError('password')" />
                <button type="button" class="btn btn-ghost btn-icon absolute top-0 right-0 text-muted-foreground"
                        (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Ocultar senha' : 'Mostrar senha'">
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" />
                </button>
              </div>
              @if (showError('password')) { <p class="text-sm text-destructive">Mínimo de 8 caracteres.</p> }
            </div>

            <button type="submit" class="btn btn-primary w-full" [disabled]="busy()">
              @if (busy()) { <app-icon name="loader" class="animate-spin" /> }
              {{ mode() === 'login' ? 'Entrar' : 'Criar conta' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly features = FEATURES;
  protected readonly preview = [
    { name: 'Alimentação', value: 'R$ 1.284,10', pct: 82, color: '#f59e0b' },
    { name: 'Transporte', value: 'R$ 642,35', pct: 48, color: '#0ea5e9' },
    { name: 'Assinaturas', value: 'R$ 318,70', pct: 26, color: '#8b5cf6' },
    { name: 'Saúde', value: 'R$ 151,20', pct: 14, color: '#ef4444' },
  ];
  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly busy = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected showError(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.touched && c.invalid;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    const isRegister = this.mode() === 'register';
    const request = isRegister ? this.auth.register(email, password) : this.auth.login(email, password);

    this.busy.set(true);
    // Errors are shown by the HTTP interceptor; here we only re-enable the button.
    request.subscribe({
      next: () => this.router.navigate([isRegister ? '/contas' : '/']),
      error: () => this.busy.set(false),
    });
  }
}
