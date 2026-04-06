import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({providedIn:'root'})
export class NuxeoClient {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private authHeader(): HttpHeaders {
    const token = this.auth.getNuxeoToken();
    return token ? new HttpHeaders({ Authorization: `Basic ${token}` }) : new HttpHeaders();
  }

  listFolder(path: string) {
    return this.http.get(`${environment.nuxeoUrl}/api/v1/content/${path}`, {
      headers: this.authHeader()
    });
  }
}
