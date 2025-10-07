import { Injectable, inject, PLATFORM_ID, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { UserModel } from '../models/user.model';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiBase = 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<UserModel | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    // Only access localStorage in browser environment
    if (isPlatformBrowser(this.platformId)) {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        this.currentUserSubject.next(UserModel.fromJSON(JSON.parse(storedUser)));
      }
    }
  }

  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiBase}/auth/login`, { username, password }).pipe(
      tap((response: any) => {
        const user = UserModel.fromJSON(response.user);
        this.currentUserSubject.next(user);
        console.log(user)
        // Only access localStorage in browser environment
        if (isPlatformBrowser(this.platformId)) {

          localStorage.setItem('currentUser', JSON.stringify(user));
          localStorage.setItem('token', response.token);
        }
      })
    );
  }

  register(username: string, password: string, email: string): Observable<any> {
    return this.http.post(`${this.apiBase}/auth/register`, { username, password, email });
  }

  logout(): void {
    this.currentUserSubject.next(null);
    
    // Only access localStorage in browser environment
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('token');
    }
  }

  getCurrentUser(): UserModel | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? user.hasRole(role) : false;
  }

  getAuthHeaders(): { [header: string]: string } {
    let token = '';
    
    // Only access localStorage in browser environment
    if (isPlatformBrowser(this.platformId)) {
      token = localStorage.getItem('token') || '';
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }



  updateUserProfileImage(profileImage: string): void {
  const currentUser = this.getCurrentUser();
  if (currentUser) {
    // Update the profile image in the current user object
    currentUser.profileImage = profileImage;
    
    // Save the updated user back to localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    console.log('Profile image updated in auth service:', profileImage);
  }
}


}