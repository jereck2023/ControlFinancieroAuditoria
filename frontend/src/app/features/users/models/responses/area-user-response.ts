import { Role } from '../../../../core/auth/roles';

export interface AreaUserResponse {
  id: number;
  userName: string;
  nombreCompleto: string;
  activo: boolean;
  roles: Role[];
}
