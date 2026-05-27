import type { Response } from 'express';

if (!process.env.JWT_SECRET) {
  throw new Error("[FATAL] JWT_SECRET غير مضبوط — لا يمكن تشغيل الخادم بأمان");
}
export const JWT_SECRET: string = process.env.JWT_SECRET;
export const IS_PROD = process.env.NODE_ENV === 'production';

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge: 4 * 60 * 60 * 1000,
    path: '/',
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8)
    return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
  if (!/[A-Z]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل';
  if (!/[0-9]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل';
  if (!/[^A-Za-z0-9]/.test(password))
    return 'كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل (@, #, $, ...)';
  return null;
}

export function daysRemaining(endDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
