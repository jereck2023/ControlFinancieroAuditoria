import { Role } from '../../../../core/auth/roles';
export interface CreateUserRequest {
  nombreUsuario: string;
  nombreCompleto: string;
  passwordInicial: string;
  areaId: number | null;
  roles: Role[];
}
export interface UpdateUserRequest {
  nombreUsuario: string;
  nombreCompleto: string;
  areaId: number | null;
}
export interface UpdateRolesRequest {
  roles: Role[];
}
export interface ResetPasswordRequest {
  passwordNueva: string;
}
