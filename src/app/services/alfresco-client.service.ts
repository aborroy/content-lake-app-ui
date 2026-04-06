import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({providedIn:'root'})
export class AlfrescoClient {
  constructor(private http: HttpClient, private auth: AuthService) {}

  private authHeader(): HttpHeaders {
    const token = this.auth.getAlfrescoToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  listFolder(path: string) {
    return this.http.get(`${environment.alfrescoUrl}/api/enterprise/${path}`, {
      headers: this.authHeader()
    });
  }
}
