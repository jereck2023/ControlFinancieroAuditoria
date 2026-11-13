import { Role } from '../../../../core/auth/roles';
interface SavedUser {
  id: number;
  userName: string;
  nombreCompleto: string;
  areaId: number | null;
  activo: boolean;
  roles: Role[];
}
export interface CreateUserResponse {
  mensaje: string;
  usuario: SavedUser & { debeCambiarPassword: boolean };
}
export interface UpdateUserResponse {
  mensaje: string;
  usuario: SavedUser;
}
export type UpdateRolesResponse =
  { mensaje: string; roles: Role[] } | { mensaje: string; usuarioId: number; roles: Role[] };
export interface UserStateResponse {
  mensaje: string;
  usuarioId: number;
  activo: boolean;
}
export interface ResetPasswordResponse {
  mensaje: string;
  usuarioId: number;
  debeCambiarPassword: boolean;
}
