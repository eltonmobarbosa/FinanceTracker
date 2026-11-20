import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ProblemDetails } from './models';
import { ToastService } from './toast.service';

/**
 * Every HTTP call goes through here: adds the JWT and turns any error into a toast.
 * Because the API always answers errors as ProblemDetails (ADR 0003), one function reads them all,
 * and pages do not need their own error handling.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);

  const token = auth.token();
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginAttempt = req.url.startsWith('/api/auth/');
      if (error.status === 401 && !isLoginAttempt) {
        auth.logout(); // expired or invalid token
        toast.error('Sua sessão expirou. Entre novamente.');
      } else {
        toast.error(problemMessage(error));
      }
      return throwError(() => error);
    }),
  );
};

export function problemMessage(error: HttpErrorResponse): string {
  if (error.status === 0) return 'Não foi possível conectar à API.';

  const problem = error.error as ProblemDetails | null;
  if (problem?.errors) return Object.values(problem.errors).flat().join(' ');
  return problem?.detail ?? problem?.title ?? 'Erro inesperado. Tente novamente.';
}
