import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  inject, 
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewChecked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageModel } from '../models/message.model';
import { AuthService } from '../services/auth.service';
import { SocketService } from '../services/socket.service';
import { PeerService } from '../services/peer.service';
import { Subscription } from 'rxjs';
import { VideoChatComponent } from '../video-chat/video-chat';
import { ImageUploadService, UploadResponse } from '../services/image-upload.service';
import { MessageService } from '../services/message.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

// Define a test message interface for our sample data
interface TestMessage {
  id: string;
  text: string;
  username: string;
  userId: string;
  timestamp: Date;
  userRoles: string[];
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoChatComponent],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private peerService = inject(PeerService);
  private imageUploadService = inject(ImageUploadService);
  private messageService = inject(MessageService);
  private http = inject(HttpClient);

  @Input() currentChannel: any = null;
  @Input() currentGroup: any = null;
  @Input() onlineUsers: any[] = [];
  @Input() isDirectMessageMode: boolean = false;
  @Input() directMessageUser: any = null;
  @Input() directMessages: MessageModel[] = [];
  @Output() exitDirectMessage = new EventEmitter<void>();
  @Output() leaveChannel = new EventEmitter<void>();
  @Output() channelHistoryLoaded = new EventEmitter<any[]>();
  @Output() sendMessage = new EventEmitter<string>();
  @Output() startVideoCall = new EventEmitter<string>();
  @Output() startAudioCall = new EventEmitter<string>();

  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: MessageModel[] = [];
  newMessage = '';
  isLoading = false;
  isTyping = false;
  typingUsers: Set<string> = new Set();
  
  // Call functionality
  showCallOptions = false;
  selectedUser: any = null;

  selectedFile: File | null = null;
  isUploading = false;
  uploadProgress = 0;
  
  private messagesSubscription: Subscription = new Subscription();
  private typingSubscription: Subscription = new Subscription();
  private userJoinedSubscription: Subscription = new Subscription();
  private userLeftSubscription: Subscription = new Subscription();
  private typingTimeout: any;
  private messageInterval: any;

  // Test data - updated to match UserModel structure
  testUsers = [
    { 
      _id: '1', 
      id: '1',
      username: 'John Doe', 
      status: 'online',
      isOnline: true,
      roles: ['user'],
      groups: [],
      profileImage: '/assets/avatars/user1.jpg',
      peerId: 'peer-john-123'
    },
    { 
      _id: '2', 
      id: '2',
      username: 'Jane Smith', 
      status: 'online',
      isOnline: true,
      roles: ['group_admin'],
      groups: [],
      profileImage: '/assets/avatars/user2.jpg',
      peerId: 'peer-jane-456'
    },
    { 
      _id: '3', 
      id: '3',
      username: 'Mike Johnson', 
      status: 'online',
      isOnline: true,
      roles: ['super_admin'],
      groups: [],
      profileImage: '/assets/avatars/user3.jpg',
      peerId: 'peer-mike-789'
    },
    { 
      _id: '4', 
      id: '4',
      username: 'Sarah Wilson', 
      status: 'online',
      isOnline: true,
      roles: ['user'],
      groups: [],
      profileImage: '/assets/avatars/user4.jpg',
      peerId: 'peer-sarah-101'
    }
  ];

  // Video call state
  showVideoChat = false;
  callTargetUser: any = null;
  callType: 'video' | 'audio' | null = null;
  
  // Image modal state
  selectedImageMessage: MessageModel | null = null;

  // Get current user
  get currentUser(): any {
    return this.authService.getCurrentUser();
  }

  ngOnInit() {
    this.setupSocketListeners();
    this.loadInitialMessages();
    this.startMessagePolling();
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
    this.leaveCurrentChannel();
    this.stopMessagePolling();
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private startMessagePolling(): void {
    // Call immediately first time
    this.getAllMessages();
    
    // Then set up interval for every minute
    this.messageInterval = setInterval(() => {
      this.getAllMessages();
    }, 60000); // 60 seconds
  }

  private stopMessagePolling(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  }

  private loadInitialMessages(): void {
    if (this.currentChannel || (this.isDirectMessageMode && this.directMessageUser)) {
      this.getAllMessages();
    }
  }

  /**
   * Get all messages for the current user from the API
   */
  getAllMessages(): void {
    console.log('🔄 Getting all messages from API...');
    
    this.isLoading = true;
    
    // Use the correct endpoint based on mode
    let apiUrl = '';
    if (this.isDirectMessageMode && this.directMessageUser) {
      // For direct messages, use the direct messages endpoint
      const currentUserId = this.currentUser?.id;
      const targetUserId = this.directMessageUser._id || this.directMessageUser.id;
      if (currentUserId && targetUserId) {
        apiUrl = `http://localhost:3000/api/messages/direct/${currentUserId}/${targetUserId}`;
      } else {
        console.log('❌ Missing user IDs for direct messages');
        this.isLoading = false;
        return;
      }
    } else if (this.currentChannel) {
      // For channel messages, use the channel messages endpoint
      const channelId = this.currentChannel._id || this.currentChannel.id;
      if (channelId) {
        apiUrl = `http://localhost:3000/api/messages/channel/${channelId}`;
      } else {
        console.log('❌ No channel ID available');
        this.isLoading = false;
        return;
      }
    } else {
      console.log('❌ No channel or direct message user selected');
      this.isLoading = false;
      return;
    }
    
    console.log('📡 API URL:', apiUrl);
    
    // Get token from localStorage
    const token = localStorage.getItem('token') || '';
    
    // Create headers with authentication
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    // Make the HTTP request
    this.http.get(apiUrl, { headers }).subscribe({
      next: (response: any) => {
        console.log('✅ Successfully fetched messages:', response);
        
        // Process messages for display
        const processedMessages = this.processMessagesForDisplay(response);
        
        // Store messages based on current mode
        if (this.isDirectMessageMode) {
          this.directMessages = processedMessages;
          console.log(`💬 Loaded ${this.directMessages.length} direct messages`);
        } else {
          this.messages = processedMessages;
          console.log(`📢 Loaded ${this.messages.length} channel messages`);
        }
        
        this.isLoading = false;
        this.channelHistoryLoaded.emit(this.messages);
        
        // Scroll to bottom after loading
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
      },
      error: (error) => {
        console.error('❌ Error fetching messages:', error);
        this.isLoading = false;
      },
      complete: () => {
        console.log('✅ getAllMessages request completed');
      }
    });
  }

  // Helper method to process messages for WhatsApp-like display
  processMessagesForDisplay(messages: any[]): any[] {
    const currentUserId = this.currentUser?.id;
    
    return messages.map(message => {
      // Determine if message is from current user
      const messageSenderId = message.senderId?._id || message.senderId;
      const isCurrentUser = messageSenderId === currentUserId;
      
      return {
        ...message,
        // Ensure we have proper IDs
        id: message._id || message.id,
        senderId: messageSenderId,
        // Add display properties
        isCurrentUser: isCurrentUser,
        displaySide: isCurrentUser ? 'right' : 'left',
        // Ensure username is available
        username: message.username || 'Unknown User',
        // Ensure profile image
        profileImage: message.profileImage || '',
        // Format timestamp for display
        displayTime: this.formatMessageTime(message.timestamp),
        displayDate: this.formatMessageDate(message.timestamp)
      };
    });
  }

  private setupSocketListeners() {
    // Listen for new messages
    this.messagesSubscription = this.socketService.onMessageReceived().subscribe(
      (message: MessageModel) => {
        if (message.channelId === this.currentChannel?._id || message.channelId === this.currentChannel?.id) {
          this.messages = [...this.messages, message];
          this.channelHistoryLoaded.emit(this.messages);
        }
      }
    );

    // Listen for new channel messages
    this.messagesSubscription.add(
      this.socketService.onMessageReceived().subscribe(
        (message: MessageModel) => {
          if (!this.isDirectMessageMode && 
              (message.channelId === this.currentChannel?._id || message.channelId === this.currentChannel?.id)) {
            this.messages = [...this.messages, message];
            this.channelHistoryLoaded.emit(this.messages);
          }
        }
      )
    );

    // Listen for direct messages
    this.messagesSubscription.add(
      this.socketService.onDirectMessageReceived().subscribe(
        (message: MessageModel) => {
          if (this.isDirectMessageMode && this.directMessageUser &&
              (message.primarySenderId === this.directMessageUser.primaryId || 
               message.primarySenderId === this.currentUser?.primaryId)) {
            this.directMessages = [...this.directMessages, message];
          }
        }
      )
    );

    // Listen for channel history
    this.messagesSubscription.add(
      this.socketService.onChannelHistory().subscribe(
        (messages: MessageModel[]) => {
          this.messages = messages;
          this.isLoading = false;
          this.channelHistoryLoaded.emit(this.messages);
        }
      )
    );

    // Listen for typing indicators
    this.typingSubscription = this.socketService.onUserTyping().subscribe(
      (data: any) => {
        const channelId = this.currentChannel?._id || this.currentChannel?.id;
        if (data.channelId === channelId) {
          if (data.typing) {
            this.typingUsers.add(data.username);
          } else {
            this.typingUsers.delete(data.username);
          }
        }
      }
    );

    // Listen for user join/leave events
    this.userJoinedSubscription = this.socketService.onUserJoined().subscribe(
      (data: any) => {
        const channelId = this.currentChannel?._id || this.currentChannel?.id;
        if (data.channelId === channelId) {
          console.log(`${data.username} joined the channel`);
        }
      }
    );

    this.userLeftSubscription = this.socketService.onUserLeft().subscribe(
      (data: any) => {
        const channelId = this.currentChannel?._id || this.currentChannel?.id;
        if (data.channelId === channelId) {
          console.log(`${data.username} left the channel`);
        }
      }
    );
  }

  private cleanupSubscriptions() {
    this.messagesSubscription.unsubscribe();
    this.typingSubscription.unsubscribe();
    this.userJoinedSubscription.unsubscribe();
    this.userLeftSubscription.unsubscribe();
  }

  // UPDATED: Send message via HTTP endpoint
  async onSendMessage() {
    console.log('onSendMessage called - New message:', this.newMessage);
    console.log('Current channel:', this.currentChannel);
    console.log('Is direct message mode:', this.isDirectMessageMode);
    
    if (this.newMessage.trim()) {
      console.log('Sending message:', this.newMessage.trim());
      
      try {
        if (this.isDirectMessageMode && this.directMessageUser) {
          // Send direct message via HTTP
          await this.sendDirectMessageHTTP(this.newMessage.trim());
        } else if (this.currentChannel) {
          // Send channel message via HTTP
          await this.sendChannelMessageHTTP(this.newMessage.trim());
        }
        
        this.newMessage = '';
        this.stopTyping();
        
        // Refresh messages immediately after sending
        setTimeout(() => {
          this.getAllMessages();
        }, 500);
      } catch (error) {
        console.error('Failed to send message:', error);
        // Fallback to socket if HTTP fails
        this.sendMessageViaSocket(this.newMessage.trim());
        this.newMessage = '';
        this.stopTyping();
      }
    } else {
      console.log('Message is empty, not sending');
    }
  }

  // Send channel message via HTTP
  private async sendChannelMessageHTTP(content: string): Promise<void> {
    const channelId = this.currentChannel?._id || this.currentChannel?.id;
    if (!channelId) {
      throw new Error('No channel selected');
    }

    const messageData = {
      channelId: channelId,
      content: content,
      messageType: 'text'
    };

    console.log('Sending channel message via HTTP:', messageData);

    try {
      const token = localStorage.getItem('token') || '';
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.post(
        'http://localhost:3000/api/messages', 
        messageData,
        { headers }
      ).toPromise();
      console.log('Channel message sent successfully via HTTP:', response);
    } catch (error) {
      console.error('Error sending channel message via HTTP:', error);
      throw error;
    }
  }

  // Send direct message via HTTP
  private async sendDirectMessageHTTP(content: string): Promise<void> {
    if (!this.directMessageUser) {
      throw new Error('No direct message user selected');
    }

    const targetUserId = this.directMessageUser._id || this.directMessageUser.id;
    if (!targetUserId) {
      throw new Error('Invalid direct message user');
    }

    const messageData = {
      targetUserId: targetUserId,
      content: content,
      messageType: 'text'
    };

    console.log('Sending direct message via HTTP:', messageData);

    try {
      const token = localStorage.getItem('token') || '';
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });

      const response = await this.http.post(
        'http://localhost:3000/api/messages/direct', 
        messageData,
        { headers }
      ).toPromise();
      console.log('Direct message sent successfully via HTTP:', response);
    } catch (error) {
      console.error('Error sending direct message via HTTP:', error);
      throw error;
    }
  }

  // Fallback to socket if HTTP fails
  private sendMessageViaSocket(content: string): void {
    console.log('Falling back to socket for message sending');
    
    if (this.isDirectMessageMode) {
      // Send direct message through socket
      console.log('Sending direct message via socket');
      this.sendDirectMessage(content);
    } else if (this.currentChannel) {
      // Send channel message through socket
      console.log('Sending channel message via socket');
      this.sendChannelMessageSocket(content);
    }
  }

  private sendDirectMessage(content: string): void {
    if (!this.directMessageUser) return;
    
    const messageData = {
      targetUserId: this.directMessageUser.primaryId || this.directMessageUser._id,
      content: content,
      messageType: 'text',
      imageUrl:'text'
    };
    
    console.log('Sending direct message via socket:', messageData);
    this.socketService.sendDirectMessage(
      messageData.targetUserId,
      messageData.content,
      messageData.messageType,
      messageData.imageUrl
    );
  }

  private sendChannelMessageSocket(content: string): void {
    if (!this.currentChannel) return;
    
    const channelId = this.currentChannel._id || this.currentChannel.id;
    const messageData = {
      channelId: channelId,
      content: content,
      messageType: 'text'
    };
    
    console.log('Sending channel message via socket:', messageData);
    this.socketService.sendMessage(messageData);
  }

  onExitDirectMessage() {
    this.exitDirectMessage.emit();
  }

  isEmptyState(): boolean {
    if (this.isDirectMessageMode) {
      return this.directMessages.length === 0;
    } else {
      return !this.currentChannel || this.messages.length === 0;
    }
  }

  onLeaveChannel() {
    this.leaveCurrentChannel();
    this.leaveChannel.emit();
  }

  private leaveCurrentChannel() {
    if (this.currentChannel) {
      const channelId = this.currentChannel._id || this.currentChannel.id;
      this.socketService.leaveChannel(channelId);
      this.messages = [];
      this.typingUsers.clear();
      this.hideCallOptions();
    }
  }

  // Call functionality methods
  toggleCallOptions(user?: any) {
    if (user) {
      this.selectedUser = user;
      this.showCallOptions = true;
    } else {
      this.showCallOptions = !this.showCallOptions;
      this.selectedUser = null;
    }
  }

  hideCallOptions() {
    this.showCallOptions = false;
    this.selectedUser = null;
  }

  onStartVideoCall(user: any): void {
    this.callTargetUser = user;
    this.callType = 'video';
    this.showVideoChat = true;
    this.hideCallOptions();
    
    setTimeout(() => {
      console.log('Starting video call with:', user);
    }, 100);
  }

  onStartAudioCall(user: any): void {
    this.callTargetUser = user;
    this.callType = 'audio';
    this.showVideoChat = true;
    this.hideCallOptions();
    
    setTimeout(() => {
      console.log('Starting audio call with:', user);
    }, 100);
  }

  // Check if user is available for call (online and has peerId)
  isUserAvailableForCall(user: any): boolean {
    const currentUser = this.currentUser;
    if (!currentUser) return false;
    
    const userId = user.primaryId || user._id || user.id;
    const currentUserId = currentUser.primaryId;
    
    return user.isOnline && 
           user.peerId && 
           user.peerId !== this.peerService.getPeerId() &&
           userId !== currentUserId;
  }

  // Get available users for calls (excluding current user)
  getAvailableUsers(): any[] {
    if (this.onlineUsers && this.onlineUsers.length > 0) {
      const currentUser = this.currentUser;
      const currentUserId = currentUser?.primaryId;
      
      return this.onlineUsers.filter(user => {
        const userId = user.primaryId || user._id || user.id;
        return userId !== currentUserId && this.isUserAvailableForCall(user);
      });
    }
    return this.testUsers;
  }

  // Check if message is from current user (for WhatsApp-style display)
  isCurrentUserMessage(message: any): boolean {
    const currentUserId = this.currentUser?.id;
    if (!currentUserId) return false;
    
    const messageSenderId = message.senderId?._id || message.senderId;
    return messageSenderId === currentUserId;
  }

  getDisplayMessages(): any[] {
    return this.isDirectMessageMode ? this.directMessages : this.messages;
  }

  onInputChange() {
    if (this.currentChannel && !this.isTyping) {
      this.isTyping = true;
      const channelId = this.currentChannel._id || this.currentChannel.id;
      this.socketService.startTyping(channelId);
      
      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 2000);
    }
  }

  private stopTyping() {
    if (this.isTyping && this.currentChannel) {
      this.isTyping = false;
      const channelId = this.currentChannel._id || this.currentChannel.id;
      this.socketService.stopTyping(channelId);
    }
  }

  getTypingText(): string {
    const users = Array.from(this.typingUsers);
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0]} is typing...`;
    if (users.length === 2) return `${users[0]} and ${users[1]} are typing...`;
    return `${users[0]} and ${users.length - 1} others are typing...`;
  }

  formatMessageTime(timestamp: string | Date): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatMessageDate(timestamp: string | Date): string {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  }

  shouldShowDateHeader(index: number): boolean {
    const messages = this.getDisplayMessages();
    if (index === 0) return true;
    
    const currentMessage = messages[index];
    const previousMessage = messages[index - 1];
    
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    
    return currentDate !== previousDate;
  }

  isConsecutiveMessage(index: number): boolean {
    const messages = this.getDisplayMessages();
    if (index === 0) return false;
    
    const currentMessage = messages[index];
    const previousMessage = messages[index - 1];
    
    const currentTime = new Date(currentMessage.timestamp).getTime();
    const previousTime = new Date(previousMessage.timestamp).getTime();
    
    const currentSenderId = currentMessage.senderId?._id || currentMessage.senderId;
    const previousSenderId = previousMessage.senderId?._id || previousMessage.senderId;
    
    return (currentSenderId === previousSenderId) && 
           ((currentTime - previousTime) < 300000); // 5 minutes
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        setTimeout(() => {
          this.messagesContainer.nativeElement.scrollTop = 
            this.messagesContainer.nativeElement.scrollHeight;
        }, 0);
      }
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }

  isImageMessage(message: any): boolean {
    return message.messageType === 'image' || message.imageUrl;
  }

  getMessageContent(message: any): string {
    if (this.isImageMessage(message)) {
      return '📷 Sent an image';
    }
    return message.content || message.primaryContent;
  }

  // Test methods
  getOnlineUsersCount(): number {
    return this.onlineUsers?.length || this.testUsers.length;
  }

  // Add test users to online users
  addTestUsers(): void {
    if (!this.onlineUsers) {
      this.onlineUsers = [];
    }
    this.testUsers.forEach(user => {
      if (!this.onlineUsers.find(u => u.userId === user._id)) {
        this.onlineUsers.push(user);
      }
    });
    console.log('Test users added:', this.onlineUsers);
  }

  // Simulate a channel for testing
  simulateChannel(): void {
    this.currentChannel = {
      id: 'test-channel-1',
      name: 'general',
      description: 'Test channel for debugging'
    };
    
    this.currentGroup = {
      id: 'test-group-1',
      name: 'Test Group',
      description: 'Test group for debugging'
    };
    
    console.log('Simulated channel:', this.currentChannel);
  }

  // Add sample messages for testing
  addSampleMessages(): void {
    const sampleMessages: TestMessage[] = [
      {
        id: '1',
        text: 'Hello everyone! 👋',
        username: 'John Doe',
        userId: '1',
        timestamp: new Date(Date.now() - 300000),
        userRoles: ['user']
      },
      {
        id: '2',
        text: 'Hi John! How are you doing?',
        username: 'Jane Smith',
        userId: '2',
        timestamp: new Date(Date.now() - 240000),
        userRoles: ['group_admin']
      },
      {
        id: '3',
        text: 'I\'m doing great! Just testing the chat features.',
        username: 'John Doe',
        userId: '1',
        timestamp: new Date(Date.now() - 180000),
        userRoles: ['user']
      },
      {
        id: '4',
        text: 'That\'s awesome! The call features are working now too!',
        username: 'Mike Johnson',
        userId: '3',
        timestamp: new Date(Date.now() - 120000),
        userRoles: ['super_admin']
      }
    ];

    this.messages = [...sampleMessages as any, ...this.messages];
    console.log('Sample messages added:', this.messages);
  }

  // Send a test message via HTTP
  async sendTestMessage(text: string): Promise<void> {
    if (!this.currentChannel) {
      this.simulateChannel();
    }

    try {
      if (this.currentChannel) {
        await this.sendChannelMessageHTTP(text);
      }
    } catch (error) {
      console.error('Failed to send test message:', error);
      // Fallback to local test message
      const testMessage: TestMessage = {
        id: Date.now().toString(),
        text: text,
        username: 'Test User',
        userId: 'test-user-1',
        timestamp: new Date(),
        userRoles: ['user']
      };

      this.messages.push(testMessage as any);
      this.newMessage = '';
      
      setTimeout(() => {
        this.scrollToBottom();
      }, 100);
    }
  }

  // Select user for call
  selectUserForCall(user: any): void {
    this.selectedUser = user;
    console.log('Selected user for call:', user);
  }

  // Deselect user
  deselectUser(): void {
    this.selectedUser = null;
  }

  // Get test users
  getTestUsers(): any[] {
    return this.testUsers;
  }

  onCallEnded(): void {
    this.showVideoChat = false;
    this.callTargetUser = null;
    this.callType = null;
  }

  getUserPeerId(user: any): string {
    return user.peerId || '';
  }

  // Image handling methods
//   onFileSelected(event: any): void {
//   console.log('File selected event:', event);
//   const file = event.target.files[0];
  
//   if (!file) {
//     console.log('No file selected');
//     return;
//   }

//   console.log('Selected file:', file.name, file.size, file.type);
  
//   const validation = this.imageUploadService.validateImageFile(file);
//   if (!validation.valid) {
//     console.log('File validation failed:', validation.error);
//     alert(validation.error);
//     return;
//   }

//   console.log('File validation passed, proceeding with upload');
//   this.selectedFile = file;
  
//   // Auto-upload when file is selected
//   this.uploadImageMessage();
// }

  // UPDATED: Upload image as message via HTTP
  async uploadImageMessage(): Promise<void> {
    if (!this.selectedFile || !this.currentChannel) return;

    this.isUploading = true;
    this.uploadProgress = 0;

    try {
      const currentUser = this.currentUser;
      const channelId = this.currentChannel._id || this.currentChannel.id;

      // Get image dimensions
      const dimensions = await this.imageUploadService.getImageDimensions(this.selectedFile);

      // Upload image
      const uploadResponse = await this.imageUploadService.uploadMessageImage(
        this.selectedFile,
        channelId,
        currentUser.primaryId
      ).toPromise();

      if (uploadResponse?.success && uploadResponse.filePath) {
        // Send image message via HTTP
        const messageData = {
          channelId: channelId,
          content: 'Shared an image', // Optional caption
          messageType: 'image',
          imageUrl: uploadResponse.filePath
        };

        console.log('Sending image message via HTTP:', messageData);
        
        const token = localStorage.getItem('token') || '';
        const headers = new HttpHeaders({
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        });

        const response = await this.http.post(
          'http://localhost:3000/api/messages', 
          messageData,
          { headers }
        ).toPromise();
        
        console.log('Image message sent successfully via HTTP:', response);
        
        // Refresh messages to show the new image message
        this.getAllMessages();
      } else {
        throw new Error(uploadResponse?.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      this.isUploading = false;
      this.selectedFile = null;
      this.uploadProgress = 0;
    }
  }

  // Handle profile image upload
  // async uploadProfileImage(event: any): Promise<void> {
  //   const file = event.target.files[0];
  //   if (!file) return;

  //   const validation = this.imageUploadService.validateImageFile(file);
  //   if (!validation.valid) {
  //     alert(validation.error);
  //     return;
  //   }

  //   try {
  //     const currentUser = this.currentUser;
  //     const uploadResponse = await this.imageUploadService.uploadProfileImage(
  //       file,
  //       currentUser.primaryId
  //     ).toPromise();

  //     if (uploadResponse?.success && uploadResponse.filePath) {
  //       // Update user profile image
  //       currentUser.profileImage = uploadResponse.filePath;
  //       alert('Profile image updated successfully!');
  //     } else {
  //       throw new Error(uploadResponse?.error || 'Upload failed');
  //     }
  //   } catch (error) {
  //     console.error('Profile image upload failed:', error);
  //     alert('Failed to upload profile image. Please try again.');
  //   }
  // }

  // Get message display text
  getMessageText(message: any): string {
    if (this.isImageMessage(message)) {
      return '📷 Shared an image';
    }
    return message.content || message.primaryContent;
  }

  // Check if message has profile image
  hasProfileImage(message: any): boolean {
    return !!message.profileImage;
  }

  // Get profile image URL
  getProfileImageUrl(message: any): string {
    if (message.profileImage?.startsWith('http')) {
      return message.profileImage;
    }
    return `http://localhost:3000${message.profileImage}`;
  }

  // Get image message URL
  getImageMessageUrl(message: any): string {
    if (message.imageUrl?.startsWith('http')) {
      return message.imageUrl;
    }
    return `http://localhost:3000${message.imageUrl}`;
  }

  formatFileSize(bytes: number | undefined | null): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  openImageModal(message: any): void {
    this.selectedImageMessage = message;
  }

  closeImageModal(): void {
    this.selectedImageMessage = null;
  }

  sendTestImage(): void {
    if (!this.currentChannel) {
      this.simulateChannel();
    }

    const currentUser = this.currentUser;
    if (!currentUser) {
      console.error('No current user found');
      alert('You must be logged in to send messages');
      return;
    }

    // Use safe property access
    const testImageMessage = MessageModel.createImageMessage(
      '/assets/test-image.jpg',
      'test-image.jpg',
      1024000,
      { width: 800, height: 600 },
      currentUser.primaryId,
      this.currentChannel?._id || this.currentChannel?.id || 'test-channel',
      currentUser.username || 'Unknown User',
      currentUser.profileImage || '',
      currentUser.roles || ['user']
    );

    this.messages.push(testImageMessage);
    
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }












  // Image handling methods
onFileSelected(event: any): void {
  console.log('File selected event:', event);
  const file = event.target.files[0];
  
  if (!file) {
    console.log('No file selected');
    return;
  }

  console.log('Selected file:', file.name, file.size, file.type);
  
  const validation = this.imageUploadService.validateImageFile(file);
  if (!validation.valid) {
    console.log('File validation failed:', validation.error);
    alert(validation.error);
    return;
  }

  console.log('File validation passed, proceeding with upload');
  this.selectedFile = file;
  
  // Auto-upload when file is selected
  this.uploadImageMessage();
}

// UPDATED: Upload image as message via HTTP
// async uploadImageMessage(): Promise<void> {
//   if (!this.selectedFile) {
//     console.log('No file selected for upload');
//     return;
//   }

//   // Check if we have a valid context
//   if (!this.currentChannel && !this.isDirectMessageMode) {
//     console.error('No channel or direct message context for image upload');
//     alert('Please select a channel or start a direct message first');
//     this.selectedFile = null;
//     return;
//   }

//   this.isUploading = true;
//   this.uploadProgress = 0;

//   try {
//     const currentUser = this.currentUser;
//     if (!currentUser) {
//       throw new Error('User not authenticated');
//     }

//     console.log('Starting image upload...');

//     // Upload image with progress tracking
//     const uploadResponse = await this.imageUploadService.uploadMessageImage(
//       this.selectedFile,
//       this.isDirectMessageMode ? 'direct' : (this.currentChannel?._id || this.currentChannel?.id),
//       currentUser.id || currentUser._id
//     ).subscribe({
//       next: (progressEvent: any) => {
//         // Handle upload progress
//         if (progressEvent.type === 'progress') {
//           this.uploadProgress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
//           console.log(`Upload progress: ${this.uploadProgress}%`);
//         } else if (progressEvent.success) {
//           // Upload completed, now send the message
//           this.sendImageMessage(progressEvent.filePath);
//         }
//       },
//       error: (error) => {
//         console.error('Image upload failed:', error);
//         this.isUploading = false;
//         this.selectedFile = null;
//         this.uploadProgress = 0;
//         alert('Failed to upload image. Please try again.');
//       }
//     });

//   } catch (error) {
//     console.error('Image upload error:', error);
//     this.isUploading = false;
//     this.selectedFile = null;
//     this.uploadProgress = 0;
//     alert('Failed to upload image. Please try again.');
//   }
// }

// Send image message after successful upload
private async sendImageMessage(imageUrl: string): Promise<void> {
  try {
    const currentUser = this.currentUser;
    
    if (this.isDirectMessageMode && this.directMessageUser) {
      // Send direct image message
      await this.sendDirectImageMessage(imageUrl);
    } else if (this.currentChannel) {
      // Send channel image message
      await this.sendChannelImageMessage(imageUrl);
    } else {
      throw new Error('No valid context for sending image message');
    }

    console.log('Image message sent successfully');
    
    // Refresh messages to show the new image
    this.getAllMessages();

  } catch (error) {
    console.error('Failed to send image message:', error);
    alert('Image uploaded but failed to send message. Please try again.');
  } finally {
    this.isUploading = false;
    this.selectedFile = null;
    this.uploadProgress = 0;
  }
}

// Send channel image message
private async sendChannelImageMessage(imageUrl: string): Promise<void> {
  const channelId = this.currentChannel?._id || this.currentChannel?.id;
  if (!channelId) {
    throw new Error('No channel selected');
  }

  const messageData = {
    channelId: channelId,
    content: 'Shared an image', // You can make this customizable
    messageType: 'image',
    imageUrl: imageUrl
  };

  console.log('Sending channel image message:', messageData);

  const token = localStorage.getItem('token') || '';
  const headers = new HttpHeaders({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  const response = await this.http.post(
    'http://localhost:3000/api/messages', 
    messageData,
    { headers }
  ).toPromise();
  
  console.log('Channel image message sent:', response);
}

// Send direct image message
private async sendDirectImageMessage(imageUrl: string): Promise<void> {
  if (!this.directMessageUser) {
    throw new Error('No direct message user selected');
  }

  const targetUserId = this.directMessageUser._id || this.directMessageUser.id;
  if (!targetUserId) {
    throw new Error('Invalid direct message user');
  }

  // For direct messages with images, we need to use a different approach
  // Since your current direct message endpoint might not support images
  // We'll create a temporary channel or use socket fallback
  
  console.log('Sending direct image message to:', targetUserId);
  
  // Fallback to socket for direct image messages
  this.sendDirectImageMessageViaSocket(targetUserId, imageUrl);
}

// Fallback for direct image messages via socket
private sendDirectImageMessageViaSocket(targetUserId: string, imageUrl: string): void {
  const messageData = {
    targetUserId: targetUserId,
    content: 'Shared an image',
    messageType: 'image',
    imageUrl: imageUrl
  };
  
  console.log('Sending direct image message via socket:', messageData);
  this.socketService.sendDirectMessage(
    messageData.targetUserId,
    messageData.content,
    messageData.messageType,
    messageData.imageUrl
  );
}

// Handle profile image upload
async uploadProfileImage(event: any): Promise<void> {
  const file = event.target.files[0];
  if (!file) return;

  const validation = this.imageUploadService.validateImageFile(file);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  this.isUploading = true;

  try {
    const currentUser = this.currentUser;
    const uploadResponse = await this.imageUploadService.uploadProfileImage(
      file,
      currentUser.id || currentUser._id
    ).toPromise();

    if (uploadResponse?.success && uploadResponse.filePath) {
      // Update user profile image in frontend
      currentUser.profileImage = uploadResponse.filePath;
      
      // Update user in backend
      await this.updateUserProfileImage(uploadResponse.filePath);
      
      alert('Profile image updated successfully!');
    } else {
      throw new Error(uploadResponse?.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Profile image upload failed:', error);
    alert('Failed to upload profile image. Please try again.');
  } finally {
    this.isUploading = false;
  }
}

// Update user profile image in backend
private async updateUserProfileImage(imageUrl: string): Promise<void> {
  try {
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const updateData = {
      profileImage: imageUrl
    };

    const response = await this.http.put(
      `http://localhost:3000/api/users/${this.currentUser.id}`,
      updateData,
      { headers }
    ).toPromise();

    console.log('Profile image updated in backend:', response);
  } catch (error) {
    console.error('Failed to update profile image in backend:', error);
  }
}
}