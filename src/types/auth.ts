export interface AuthUser {
  id: string;
  email?: string;
  nativeLanguage?: 'CHINESE' | 'VIETNAMESE' | 'OTHER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
