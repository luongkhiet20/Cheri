export interface JwtPayload {
  email: string;
  id?: string;
  roles?: string[];
  permissions?: string[];
}
