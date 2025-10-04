import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GroupModel } from '../models/group.model';
import { AuthService } from './auth.service';
import { UserModel } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiBase = 'http://localhost:3000/api';

  // Get all groups (with filtering based on user role)
  getAllGroups(): Observable<GroupModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/groups`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(groups => groups.map(group => GroupModel.fromJSON(group)))
    );
  }

  // Get groups for current user
  getUserGroups(): Observable<GroupModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/groups/my-groups`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(groups => groups.map(group => GroupModel.fromJSON(group)))
    );
  }

  // Get a specific group by ID
  getGroup(groupId: string): Observable<GroupModel> {
    return this.http.get<any>(`${this.apiBase}/groups/${groupId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(group => GroupModel.fromJSON(group))
    );
  }

  // Create a new group
  createGroup(name: string, description: string = ''): Observable<GroupModel> {
    return this.http.post<any>(`${this.apiBase}/groups`, { 
      name, 
      description 
    }, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(group => GroupModel.fromJSON(group))
    );
  }

  // Update a group
  updateGroup(groupId: string, updates: { name?: string; description?: string }): Observable<GroupModel> {
    return this.http.put<any>(`${this.apiBase}/groups/${groupId}`, updates, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(group => GroupModel.fromJSON(group))
    );
  }

  // Delete a group
  deleteGroup(groupId: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/groups/${groupId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Member management
  addUserToGroup(groupId: string, userId: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/groups/${groupId}/members`, 
      { userId },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  removeUserFromGroup(groupId: string, userId: string): Observable<any> {
    return this.http.delete(
      `${this.apiBase}/groups/${groupId}/members/${userId}`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  getGroupMembers(groupId: string): Observable<UserModel[]> {
    return this.http.get<any[]>(
      `${this.apiBase}/groups/${groupId}/members`,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      map(users => users.map(user => UserModel.fromJSON(user)))
    );
  }

  // Admin management
  promoteToGroupAdmin(groupId: string, userId: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/groups/${groupId}/admins`,
      { userId },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  demoteFromGroupAdmin(groupId: string, userId: string): Observable<any> {
    return this.http.delete(
      `${this.apiBase}/groups/${groupId}/admins/${userId}`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  // Group invitations
  inviteUserToGroup(groupId: string, email: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/groups/${groupId}/invitations`,
      { email },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  acceptGroupInvitation(invitationId: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/groups/invitations/${invitationId}/accept`,
      {},
      { headers: this.authService.getAuthHeaders() }
    );
  }

  declineGroupInvitation(invitationId: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/groups/invitations/${invitationId}/decline`,
      {},
      { headers: this.authService.getAuthHeaders() }
    );
  }

  getPendingInvitations(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiBase}/groups/invitations/pending`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  // Group statistics
  getGroupStats(groupId: string): Observable<{
    memberCount: number;
    channelCount: number;
    messageCount: number;
    activeUsers: number;
    createdAt: Date;
  }> {
    return this.http.get<{
      memberCount: number;
      channelCount: number;
      messageCount: number;
      activeUsers: number;
      createdAt: Date;
    }>(`${this.apiBase}/groups/${groupId}/stats`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Search groups
  searchGroups(query: string): Observable<GroupModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/groups/search?q=${encodeURIComponent(query)}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(groups => groups.map(group => GroupModel.fromJSON(group)))
    );
  }

  // Leave a group
  leaveGroup(groupId: string): Observable<any> {
    return this.http.delete(
      `${this.apiBase}/groups/${groupId}/leave`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  // Transfer group ownership
  transferOwnership(groupId: string, newOwnerId: string): Observable<any> {
    return this.http.post(
      `${this.apiBase}/groups/${groupId}/transfer`,
      { newOwnerId },
      { headers: this.authService.getAuthHeaders() }
    );
  }
}