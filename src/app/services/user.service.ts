import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { UserModel } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiBase = 'http://localhost:3000/api';
  private apiUrl = 'http://localhost:3000/api/users';

  getAllUsers(): Observable<UserModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/users`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(users => users.map(user => UserModel.fromJSON(user)))
    );
  }

  promoteUser(userId: string): Observable<any> {
    return this.http.post(`${this.apiBase}/users/${userId}/promote`, {}, {
      headers: this.authService.getAuthHeaders()
    });
  }

  getUserGroups(userId: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/${userId}/groups`);
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/users/${userId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Add the missing updateUserProfile method
  updateUserProfile(userId: string, updates: { profileImage?: string; username?: string; email?: string }): Observable<UserModel> {
    return this.http.put<any>(`${this.apiBase}/users/${userId}/profile`, updates, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(user => UserModel.fromJSON(user))
    );
  }

  // Additional useful methods for user management
  getUserById(userId: string): Observable<UserModel> {
    return this.http.get<any>(`${this.apiBase}/users/${userId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(user => UserModel.fromJSON(user))
    );
  }

  updateUser(userId: string, userData: any): Observable<UserModel> {
    return this.http.put<any>(`${this.apiBase}/users/${userId}`, userData, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(user => UserModel.fromJSON(user))
    );
  }

  // Method to update online status
  updateUserStatus(userId: string, isOnline: boolean): Observable<any> {
    return this.http.patch(`${this.apiBase}/users/${userId}/status`, 
      { isOnline },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  // Method to search users
  searchUsers(query: string): Observable<UserModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/users/search`, {
      params: { q: query },
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(users => users.map(user => UserModel.fromJSON(user)))
    );
  }


  // In user.service.ts - add this method
updateUserProfileImage(userId: string, profileImage: string): Observable<any> {
  return this.http.put(`${this.apiUrl}/users/${userId}/profile-image`, {
    profileImage: profileImage
  });
}
}