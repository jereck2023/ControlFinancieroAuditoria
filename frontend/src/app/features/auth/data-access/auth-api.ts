import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { LoginRequest } from '../models/requests/login-request';
import { ChangePasswordRequest } from '../models/requests/change-password-request';
import { LoginResponse } from '../models/responses/login-response';
import { ChangePasswordResponse } from '../models/responses/change-password-response';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/auth`;
  login(request: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.url}/login`, request);
  }
  changePassword(request: ChangePasswordRequest) {
    return this.http.post<ChangePasswordResponse>(`${this.url}/cambiar-password`, request);
  }
}
