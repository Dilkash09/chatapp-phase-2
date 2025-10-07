import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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

  // UPDATED: Get current user's groups with better error handling
  getCurrentUserGroups(): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    
    // Check if user is properly logged in
    if (!currentUser) {
      console.error('No user logged in - currentUser is null');
      return throwError(() => new Error('Please log in to access this feature'));
    }
    
    if (!currentUser._id && !currentUser.id) {
      console.error('User logged in but missing ID:', currentUser);
      return throwError(() => new Error('User session is invalid. Please log in again.'));
    }

    const userId = currentUser._id || currentUser.id;
    console.log('Fetching groups for user ID:', userId);
    
    return this.http.get<any[]>(`${this.apiUrl}/${userId}/groups`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      catchError(error => {
        console.error('Error fetching user groups:', error);
        return throwError(() => new Error('Failed to load user groups. Please try again.'));
      })
    );
  }

  // UPDATED: Get current user's group IDs with error handling
  getCurrentUserGroupIds(): Observable<string[]> {
    return this.getCurrentUserGroups().pipe(
      map(groups => groups.map(group => group._id)),
      catchError(error => {
        console.error('Error getting group IDs:', error);
        return throwError(() => error);
      })
    );
  }

  // UPDATED: Get users by groups with error handling
  getUsersByGroups(groupIds: string[]): Observable<UserModel[]> {
    if (!groupIds || groupIds.length === 0) {
      return throwError(() => new Error('No group IDs provided'));
    }

    const groupsParam = groupIds.join(',');
    console.log('Fetching users for groups:', groupsParam);
    
    return this.http.get<any[]>(`${this.apiUrl}/by-groups/${groupsParam}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(users => users.map(user => UserModel.fromJSON(user))),
      catchError(error => {
        console.error('Error fetching users by groups:', error);
        return throwError(() => new Error('Failed to load users from groups. Please try again.'));
      })
    );
  }

  deleteUser(userId: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/users/${userId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  updateUserProfile(userId: string, updates: { profileImage?: string; username?: string; email?: string }): Observable<UserModel> {
    return this.http.put<any>(`${this.apiBase}/users/${userId}/profile`, updates, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(user => UserModel.fromJSON(user))
    );
  }

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

  updateUserStatus(userId: string, isOnline: boolean): Observable<any> {
    return this.http.patch(`${this.apiBase}/users/${userId}/status`, 
      { isOnline },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  searchUsers(query: string): Observable<UserModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/users/search`, {
      params: { q: query },
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(users => users.map(user => UserModel.fromJSON(user)))
    );
  }

  updateUserProfileImage(userId: string, profileImage: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${userId}/profile-image`, {
      profileImage: profileImage
    });
  }
}