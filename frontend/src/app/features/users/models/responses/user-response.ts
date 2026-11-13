import { Role } from '../../../../core/auth/roles';
export interface UserResponse {
  id: number;
  userName: string;
  nombreCompleto: string;
  areaId: number | null;
  nombreArea: string | null;
  activo: boolean;
  debeCambiarPassword: boolean;
  roles: Role[];
}
