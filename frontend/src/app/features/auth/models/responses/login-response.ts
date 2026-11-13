import { Role } from '../../../../core/auth/roles';
export interface LoginResponse {
  mensaje: string;
  token: string;
  expiracion: string;
  usuario: string;
  roles: Role[];
  debeCambiarPassword: boolean;
}
