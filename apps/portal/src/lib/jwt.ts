import jwt from 'jsonwebtoken';
import type { OrbitJwtPayload } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET!;
const TOKEN_EXPIRY = '1h';

export function signOrbitToken(
  payload: Omit<OrbitJwtPayload, 'iat' | 'exp' | 'aud'>,
  options?: { aud?: string }
): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
    algorithm: 'HS256',
    ...(options?.aud ? { audience: options.aud } : {}),
  });
}

export function verifyOrbitToken(token: string): OrbitJwtPayload {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
  }) as OrbitJwtPayload;
}
