// services/message.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { SocketService } from './socket.service';
import { AuthService } from './auth.service'; // Add this import
import { Observable } from 'rxjs';
import { MessageModel } from '../models/message.model';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private socketService = inject(SocketService);
  private authService = inject(AuthService); // Add this
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/api';

  // Add method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    let token = '';
    
    // Only access localStorage in browser environment
    
      token = localStorage.getItem('token') || '';
    
    
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Send a message
  sendMessage(messageData: { channelId: string; content: string; messageType?: string; imageUrl?: string }): void {
    this.socketService.sendMessage(messageData);
  }

  // Send direct message
  sendDirectMessage(targetUserId: string,messageData:string , content: string, messageType?: string): void {
    this.socketService.sendDirectMessage(targetUserId, content, messageType,messageData);
  }

  // Join a channel
  joinChannel(channelId: string): void {
    this.socketService.joinChannel(channelId);
  }

  // Leave a channel
  leaveChannel(channelId: string): void {
    this.socketService.leaveChannel(channelId);
  }

  // Listen for new messages
  onMessageReceived(): Observable<any> {
    return this.socketService.onMessageReceived();
  }

  // Listen for direct messages
  onDirectMessageReceived(): Observable<any> {
    return this.socketService.onDirectMessageReceived();
  }

  // Listen for channel history
  onChannelHistory(): Observable<any[]> {
    return this.socketService.onChannelHistory();
  }

  // Listen for direct message history
  onDirectMessageHistory(): Observable<any[]> {
    return this.socketService.onDirectMessageHistory();
  }

  // Listen for errors
  onError(): Observable<any> {
    return this.socketService.onError();
  }

  // Typing indicators
  startTyping(channelId: string): void {
    this.socketService.startTyping(channelId);
  }

  stopTyping(channelId: string): void {
    this.socketService.stopTyping(channelId);
  }

  // Direct message typing
  startDirectMessageTyping(targetUserId: string): void {
    this.socketService.startDirectMessageTyping(targetUserId);
  }

  stopDirectMessageTyping(targetUserId: string): void {
    this.socketService.stopDirectMessageTyping(targetUserId);
  }

  onUserTyping(): Observable<any> {
    return this.socketService.onUserTyping();
  }

  onDirectMessageTyping(): Observable<any> {
    return this.socketService.onDirectMessageTyping();
  }

  // HTTP methods for message history - UPDATED WITH AUTH HEADERS
  getChannelMessages(channelId: string): Observable<MessageModel[]> {
    return this.http.get<MessageModel[]>(
      `${this.apiUrl}/messages/channel/${channelId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Add this method for direct messages - UPDATED WITH AUTH HEADERS
  getDirectMessages(userId1: string, userId2: string): Observable<MessageModel[]> {
    return this.http.get<MessageModel[]>(
      `${this.apiUrl}/messages/direct/${userId1}/${userId2}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Get message by ID - UPDATED WITH AUTH HEADERS
  getMessageById(messageId: string): Observable<MessageModel> {
    return this.http.get<MessageModel>(
      `${this.apiUrl}/messages/${messageId}`,
      { headers: this.getAuthHeaders() }
    );
  }
  // Add this method to your MessageService
createDirectMessage(messageData: { 
  targetUserId: string; 
  content: string; 
  messageType?: string; 
}): Observable<MessageModel> {
  return this.http.post<MessageModel>(
    `${this.apiUrl}/messages/direct`,
    messageData,
    { headers: this.getAuthHeaders() }
  );
}
  // Delete message - UPDATED WITH AUTH HEADERS
  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/messages/${messageId}`,
      { headers: this.getAuthHeaders() }
    );
  }

  // Update message - UPDATED WITH AUTH HEADERS
  updateMessage(messageId: string, content: string): Observable<MessageModel> {
    return this.http.put<MessageModel>(
      `${this.apiUrl}/messages/${messageId}`,
      { content },
      { headers: this.getAuthHeaders() }
    );
  }

  // Create message via HTTP (alternative to socket) - UPDATED WITH AUTH HEADERS
  createMessage(messageData: { 
    channelId: string; 
    content: string; 
    messageType?: string; 
    imageUrl?: string 
  }): Observable<MessageModel> {
    return this.http.post<MessageModel>(
      `${this.apiUrl}/messages`,
      messageData,
      { headers: this.getAuthHeaders() }
    );
  }
}