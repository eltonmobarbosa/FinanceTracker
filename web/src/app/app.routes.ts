import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

// Pages are lazy-loaded: each one is a separate JS chunk downloaded on first visit.
export const routes: Routes = [
  { path: 'login', title: 'Entrar · FinanceTracker', loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', title: 'Visão geral · FinanceTracker', loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage) },
      { path: 'transacoes', title: 'Transações · FinanceTracker', loadComponent: () => import('./pages/transactions').then((m) => m.TransactionsPage) },
      { path: 'contas', title: 'Contas e importação · FinanceTracker', loadComponent: () => import('./pages/accounts').then((m) => m.AccountsPage) },
      { path: 'categorias', title: 'Categorias e regras · FinanceTracker', loadComponent: () => import('./pages/categories').then((m) => m.CategoriesPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
