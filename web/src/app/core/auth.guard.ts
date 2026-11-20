import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** UX only: hides pages from logged-out users. The real protection is the API rejecting requests without a token. */
export const authGuard: CanActivateFn = () =>
  inject(AuthService).token() !== null || inject(Router).createUrlTree(['/login']);
