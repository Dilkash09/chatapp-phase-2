import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { MessageModel } from '../models/message.model';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;

  constructor() {
    this.initializeSocket();
  }

  private initializeSocket(): void {
    try {
      this.socket = io('http://localhost:3000', {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize socket:', error);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Connect to server
  connect(): void {
    if (this.socket && !this.isConnected) {
      this.socket.connect();
    }
  }

  // Disconnect from server
  disconnect(): void {
    if (this.socket && this.isConnected) {
      this.socket.disconnect();
    }
  }

  // Authentication
  authenticate(userId: string, token: string, peerId?: string): void {
    if (this.socket) {
      this.socket.emit('authenticate', { userId, token, peerId });
    }
  }

  onAuthenticated(): Observable<{ success: boolean; error?: string }> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('authenticated', (data) => {
          observer.next(data);
        });
      }
    });
  }

  // Channel Management
  joinChannel(channelId: string): void {
    if (this.socket) {
      this.socket.emit('join-channel', { channelId });
    }
  }

  leaveChannel(channelId: string): void {
    if (this.socket) {
      this.socket.emit('leave-channel', { channelId });
    }
  }

  // Messages
  sendMessage(messageData: { 
    channelId: string; 
    content: string; 
    messageType?: string; 
    imageUrl?: string;
  }): void {
    if (this.socket) {
      this.socket.emit('send-message', messageData);
    }
  }

  // Send direct message - ADD THIS METHOD
  sendDirectMessage(targetUserId: string, content: string, messageType: string = 'text', imageUrl: string): void {
    if (this.socket) {
      this.socket.emit('send-direct-message', {
        targetUserId,
        content,
        messageType
      });
    }
  }

  // Alternative sendDirectMessage that accepts an object
  sendDirectMessageObj(messageData: {
    senderId: string;
    receiverId: string;
    content: string;
    messageType?: string;
    timestamp?: Date;
  }): void {
    if (this.socket) {
      this.socket.emit('send-direct-message', messageData);
    }
  }

  onMessageReceived(): Observable<MessageModel> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('new-message', (message) => {
          observer.next(message);
        });
      }
    });
  }

  // Add this method for direct messages
  onDirectMessageReceived(): Observable<MessageModel> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('direct-message', (message) => {
          observer.next(message);
        });
      }
    });
  }

  onChannelHistory(): Observable<MessageModel[]> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('channel-history', (messages) => {
          observer.next(messages);
        });
      }
    });
  }

  // Get direct message history - ADD THIS METHOD
  getDirectMessageHistory(targetUserId: string): void {
    if (this.socket) {
      this.socket.emit('get-direct-messages', { targetUserId });
    }
  }

  onDirectMessageHistory(): Observable<MessageModel[]> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('direct-message-history', (messages) => {
          observer.next(messages);
        });
      }
    });
  }

  // User Presence
  onUserJoined(): Observable<{ userId: string; username: string; channelId: string; timestamp: Date }> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('user-joined', (data) => {
          observer.next(data);
        });
      }
    });
  }

  onUserLeft(): Observable<{ userId: string; username: string; channelId: string; timestamp: Date; reason?: string }> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('user-left', (data) => {
          observer.next(data);
        });
      }
    });
  }

  // Online users
  onOnlineUsersUpdate(): Observable<any[]> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('online-users', (users) => {
          observer.next(users);
        });
      }
    });
  }

  // Typing Indicators
  startTyping(channelId: string): void {
    if (this.socket) {
      this.socket.emit('typing-start', { channelId });
    }
  }

  stopTyping(channelId: string): void {
    if (this.socket) {
      this.socket.emit('typing-stop', { channelId });
    }
  }

  // Direct message typing - ADD THESE METHODS
  startDirectMessageTyping(targetUserId: string): void {
    if (this.socket) {
      this.socket.emit('direct-typing-start', { targetUserId });
    }
  }

  stopDirectMessageTyping(targetUserId: string): void {
    if (this.socket) {
      this.socket.emit('direct-typing-stop', { targetUserId });
    }
  }

  onUserTyping(): Observable<{ userId: string; username: string; channelId: string; typing: boolean }> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('user-typing', (data) => {
          observer.next(data);
        });
      }
    });
  }

  onDirectMessageTyping(): Observable<{ userId: string; username: string; typing: boolean }> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('direct-message-typing', (data) => {
          observer.next(data);
        });
      }
    });
  }

  // Connection Events
  onConnect(): Observable<void> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('connect', () => {
          observer.next();
        });
      }
    });
  }

  onDisconnect(): Observable<void> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('disconnect', () => {
          observer.next();
        });
      }
    });
  }

  onError(): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on('error', (error) => {
          observer.next(error);
        });
      }
    });
  }

  // Get connection status
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Get socket instance (for debugging)
  getSocket(): Socket | null {
    return this.socket;
  }

  
}