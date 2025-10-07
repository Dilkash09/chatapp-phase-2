import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ChannelModel } from '../models/channel.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ChannelService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiBase = 'http://localhost:3000/api';

  // Get all channels for a group
  getChannelsForGroup(groupId: string): Observable<ChannelModel[]> {
    return this.http.get<any[]>(`${this.apiBase}/groups/${groupId}/channels`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(channels => channels.map(channel => ChannelModel.fromJSON(channel)))
    );
  }

  // Get a specific channel by ID
  getChannel(channelId: string): Observable<ChannelModel> {
    return this.http.get<any>(`${this.apiBase}/channels/${channelId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(channel => ChannelModel.fromJSON(channel))
    );
  }

  // Create a new channel
  createChannel(groupId: string, name: string, description: string = ''): Observable<ChannelModel> {
    return this.http.post<any>(`${this.apiBase}/groups/${groupId}/channels`, { 
      name, 
      description 
    }, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(channel => ChannelModel.fromJSON(channel))
    );
  }

  // Update a channel
  updateChannel(channelId: string, updates: { name?: string; description?: string }): Observable<ChannelModel> {
    return this.http.put<any>(`${this.apiBase}/channels/${channelId}`, updates, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      map(channel => ChannelModel.fromJSON(channel))
    );
  }

  // Delete a channel
  deleteChannel(channelId: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/channels/${channelId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Ban a user from a channel
  banUserFromChannel(channelId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiBase}/channels/${channelId}/ban`, 
      { userId },
      { headers: this.authService.getAuthHeaders() }
    );
  }

  // Unban a user from a channel
  unbanUserFromChannel(channelId: string, userId: string): Observable<any> {
    return this.http.delete(`${this.apiBase}/channels/${channelId}/ban/${userId}`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Get banned users for a channel
  getBannedUsers(channelId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBase}/channels/${channelId}/banned`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  // Check if user has access to channel
  checkChannelAccess(channelId: string): Observable<{ hasAccess: boolean; reason?: string }> {
    return this.http.get<{ hasAccess: boolean; reason?: string }>(
      `${this.apiBase}/channels/${channelId}/access`,
      { headers: this.authService.getAuthHeaders() }
    );
  }

  // Get channel statistics
  getChannelStats(channelId: string): Observable<{
    messageCount: number;
    activeUsers: number;
    lastActivity: Date;
  }> {
    return this.http.get<{
      messageCount: number;
      activeUsers: number;
      lastActivity: Date;
    }>(`${this.apiBase}/channels/${channelId}/stats`, {
      headers: this.authService.getAuthHeaders()
    });
  }
}