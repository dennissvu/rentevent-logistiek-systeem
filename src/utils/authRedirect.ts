export interface LoginLocationState {
  from?: { pathname: string };
}

/**
 * Determines where to redirect after successful login.
 * Used by the login route to send users back to the page they tried to visit.
 */
export function getRedirectToAfterLogin(state: LoginLocationState | null): string {
  const from = state?.from?.pathname;
  if (from && from !== "/login") return from;
  return "/";
}
