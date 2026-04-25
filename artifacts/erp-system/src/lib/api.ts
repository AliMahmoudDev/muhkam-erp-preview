/** App base URL without trailing slash (e.g. '' or '/app'). */
export const BASE: string = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Resolves an API path against the app's BASE_URL.
 *  Usage:  api('/api/users')  →  '/api/users'  (or '/app/api/users' if base-path is set)
 */
export const api = (path: string): string => `${BASE}${path}`;
