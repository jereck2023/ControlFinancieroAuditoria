import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateRolesRequest,
  ResetPasswordRequest,
} from '../models/requests/user-requests';
import { UserResponse } from '../models/responses/user-response';
import {
  CreateUserResponse,
  UpdateUserResponse,
  UpdateRolesResponse,
  UserStateResponse,
  ResetPasswordResponse,
} from '../models/responses/user-mutation-responses';

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/usuarios`;
  list() {
    return this.http.get<UserResponse[]>(this.url);
  }
  get(id: number) {
    return this.http.get<UserResponse>(`${this.url}/${id}`);
  }
  create(request: CreateUserRequest) {
    return this.http.post<CreateUserResponse>(this.url, request);
  }
  update(id: number, request: UpdateUserRequest) {
    return this.http.put<UpdateUserResponse>(`${this.url}/${id}`, request);
  }
  updateRoles(id: number, request: UpdateRolesRequest) {
    return this.http.put<UpdateRolesResponse>(`${this.url}/${id}/roles`, request);
  }
  setActive(id: number, active: boolean) {
    return this.http.put<UserStateResponse>(
      `${this.url}/${id}/${active ? 'activar' : 'desactivar'}`,
      {},
    );
  }
  resetPassword(id: number, request: ResetPasswordRequest) {
    return this.http.put<ResetPasswordResponse>(`${this.url}/${id}/restablecer-password`, request);
  }
}
