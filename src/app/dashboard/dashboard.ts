// dashboard.ts - Enhanced version with group members and profile pictures
import { Component, OnInit, forwardRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChatComponent } from '../chat/chat';
import { AuthService } from '../services/auth.service';
import { SocketService } from '../services/socket.service';
import { GroupService } from '../services/group.service';
import { ChannelService } from '../services/channel.service';
import { MessageService } from '../services/message.service';
import { UserService } from '../services/user.service';
import { ImageUploadService } from '../services/image-upload.service';
import { MessageModel } from '../models/message.model';
import { GroupModel } from '../models/group.model';
import { ChannelModel } from '../models/channel.model';
import { UserModel } from '../models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, forwardRef(() => ChatComponent)],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private groupService = inject(GroupService);
  private channelService = inject(ChannelService);
  private messageService = inject(MessageService);
  private userService = inject(UserService);
  private imageUploadService = inject(ImageUploadService);
  private router = inject(Router);

  // Public properties for template access
  currentUser: UserModel | null = null;
  currentGroup: GroupModel | null = null;
  currentChannel: ChannelModel | null = null;
  groups: GroupModel[] = [];
  channels: ChannelModel[] = [];
  messages: MessageModel[] = [];
  isLoading = false;
  errorMessage = '';

  // Group members and user management
  groupMembers: UserModel[] = [];
  showMembersPanel = false;
  selectedMember: UserModel | null = null;

  // Profile picture upload
  isUploadingProfile = false;
  uploadProgress = 0;
  isDirectMessageMode = false;
  directMessageUser: UserModel | null = null;
  directMessages: MessageModel[] = [];

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadUserGroups();
    
    // Initialize socket connection
    this.socketService.authenticate(
      this.currentUser.primaryId,
      this.currentUser.token || '',
      this.currentUser.peerId
    );
  }

  // Public methods for template access
  hasRole(role: string): boolean {
    return this.authService.hasRole(role);
  }

  async loadUserGroups() {
    this.isLoading = true;
    try {
      this.groups = await this.groupService.getUserGroups().toPromise() || [];
    } catch (error) {
      console.error('Error loading groups:', error);
      this.errorMessage = 'Failed to load groups';
    } finally {
      this.isLoading = false;
    }
  }

  async loadChannelsForGroup(groupId: string) {
    this.isLoading = true;
    try {
      this.channels = await this.channelService.getChannelsForGroup(groupId).toPromise() || [];
    } catch (error) {
      console.error('Error loading channels:', error);
      this.errorMessage = 'Failed to load channels';
    } finally {
      this.isLoading = false;
    }
  }

  async loadGroupMembers(groupId: string) {
    try {
      const members = await this.groupService.getGroupMembers(groupId).toPromise() || [];
      this.groupMembers = members.map(member => UserModel.fromJSON(member));
    } catch (error) {
      console.error('Error loading group members:', error);
      this.groupMembers = [];
    }
  }

  async selectGroup(group: GroupModel) {
    this.currentGroup = group;
    this.currentChannel = null;
    this.messages = [];
    this.showMembersPanel = false;
    await this.loadChannelsForGroup(group.primaryId);
    await this.loadGroupMembers(group.primaryId);
  }

  async selectChannel(channel: ChannelModel) {
    // Leave current channel if any
    if (this.currentChannel) {
      const currentChannelId = this.currentChannel.primaryId;
      if (currentChannelId) {
        this.socketService.leaveChannel(currentChannelId);
      }
    }

    this.currentChannel = channel;
    this.messages = [];
    
    // Join new channel via socket
    const channelId = channel.primaryId;
    if (channelId) {
      this.socketService.joinChannel(channelId);
      await this.loadMessagesForChannel(channelId);
    }
  }

  // onSendMessage(messageContent: string) {
  //   if (!this.currentChannel) return;

  //   const channelId = this.currentChannel.primaryId;
  //   if (!channelId) return;

  //   const messageData = {
  //     channelId: channelId,
  //     content: messageContent,
  //     messageType: 'text' as const
  //   };

  //   this.socketService.sendMessage(messageData);
  // }

  onLeaveChannel() {
    if (this.currentChannel) {
      const channelId = this.currentChannel.primaryId;
      if (channelId) {
        this.socketService.leaveChannel(channelId);
      }
    }
    this.currentChannel = null;
    this.messages = [];
  }

  // onChannelHistoryLoaded(messages: MessageModel[]) {
  //   this.messages = messages;
  // }

  // Group members management
  toggleMembersPanel() {
    this.showMembersPanel = !this.showMembersPanel;
  }

  // selectMember(member: UserModel) {
  //   this.selectedMember = member;
  //   // Here you can implement direct messaging functionality
  //   console.log('Selected member for messaging:', member.username);
  //   // You might want to open a direct message chat interface
  //   this.openDirectMessage(member);
  // }

  // openDirectMessage(member: UserModel) {
  //   // Implement direct messaging functionality
  //   // This could open a separate chat interface for direct messages
  //   alert(`Opening direct message with ${member.username}`);
    
  //   // For now, we'll just show a message
  //   // In a real implementation, you would:
  //   // 1. Create/load a direct message channel
  //   // 2. Switch the chat interface to direct message mode
  //   // 3. Handle the messaging through sockets
  // }

  // Profile picture upload
  // In dashboard.ts - update the uploadProfilePicture method
// In dashboard.ts - update the uploadProfilePicture method
async uploadProfilePicture(event: any) {
  const file = event.target.files[0];
  if (!file) return;

  // Check if user is authenticated
  if (!this.currentUser || !this.currentUser.token) {
    alert('Please log in again');
    this.router.navigate(['/login']);
    return;
  }

  const validation = this.imageUploadService.validateImageFile(file);
  if (!validation.valid) {
    alert(validation.error);
    return;
  }

  this.isUploadingProfile = true;
  this.uploadProgress = 0;

  try {
    console.log('Starting profile picture upload for user:', this.currentUser.primaryId);

    const uploadResponse = await this.imageUploadService.uploadProfileImage(
      file,
      this.currentUser.primaryId
    ).toPromise();

    console.log('Upload response:', uploadResponse);

    if (uploadResponse?.success && uploadResponse.filePath) {
      // Update current user's profile picture using the correct endpoint
      const updateResponse = await this.userService.updateUserProfileImage(
        this.currentUser.primaryId,
        uploadResponse.filePath
      ).toPromise();
      
      // Update local user data
      this.currentUser.profileImage = uploadResponse.filePath;
      
      // Update local storage with new profile image
      this.authService.updateUserProfileImage(uploadResponse.filePath);
      
      alert('Profile picture updated successfully!');
      
      // Refresh user data
      this.currentUser = this.authService.getCurrentUser();
      
    } else {
      throw new Error(uploadResponse?.error || 'Upload failed');
    }
  } catch (error: any) {
    console.error('Profile picture upload failed:', error);
    
    let errorMessage = 'Failed to upload profile picture. Please try again.';
    
    if (error.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
      this.router.navigate(['/login']);
    } else if (error.status === 413) {
      errorMessage = 'File too large. Please select an image smaller than 5MB.';
    } else if (error.error?.error) {
      errorMessage = error.error.error;
    }
    
    alert(errorMessage);
  } finally {
    this.isUploadingProfile = false;
    this.uploadProgress = 0;
    // Reset the file input
    event.target.value = '';
  }
}

  getProfileImageUrl(user: UserModel): string {
    if (!user.profileImage) return '';
    
    if (user.profileImage.startsWith('http')) {
      return user.profileImage;
    }
    
    // For local files, you might need to adjust the base URL
    return user.profileImage.startsWith('/') ? user.profileImage : `/${user.profileImage}`;
  }

  getInitials(username: string): string {
    if (!username) return '?';
    return username
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // Group management methods
  async showAvailableGroups() {
    try {
      const allGroups = await this.groupService.getAllGroups().toPromise() || [];
      const userGroupIds = this.groups.map(g => g.primaryId);
      const availableGroups = allGroups.filter(group => !userGroupIds.includes(group.primaryId));
      
      if (availableGroups.length === 0) {
        alert('No available groups to join');
        return;
      }

      const groupNames = availableGroups.map(g => g.name).join('\n');
      const groupName = prompt(`Available groups:\n${groupNames}\n\nEnter the group name you want to join:`);
      
      if (!groupName) return;

      const selectedGroup = availableGroups.find(g => g.name === groupName);
      if (!selectedGroup) {
        alert('Group not found');
        return;
      }

      await this.groupService.addUserToGroup(selectedGroup.primaryId, this.currentUser!.primaryId).toPromise();
      await this.loadUserGroups();
      alert(`Joined group "${groupName}" successfully`);
    } catch (error: any) {
      alert('Failed to join group: ' + (error.error?.error || error.message));
    }
  }

  async createNewGroup() {
    const groupName = prompt('Enter name for new group:');
    if (!groupName) return;

    const groupDescription = prompt('Enter description for new group:') || '';

    try {
      await this.groupService.createGroup(groupName, groupDescription).toPromise();
      await this.loadUserGroups();
      alert(`Group "${groupName}" created successfully`);
    } catch (error: any) {
      alert('Failed to create group: ' + (error.error?.error || error.message));
    }
  }

  async createNewChannel() {
    if (!this.currentGroup) {
      alert('Please select a group first');
      return;
    }

    const channelName = prompt('Enter name for new channel:');
    if (!channelName) return;

    try {
      await this.channelService.createChannel(this.currentGroup.primaryId, channelName).toPromise();
      await this.loadChannelsForGroup(this.currentGroup.primaryId);
      alert(`Channel "${channelName}" created successfully`);
    } catch (error: any) {
      alert('Failed to create channel: ' + (error.error?.error || error.message));
    }
  }

  navigateToAdmin() {
    this.router.navigate(['/admin']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  clearError() {
    this.errorMessage = '';
  }

  // Helper methods for template
  loadMessagesForChannel(channelId: string): Promise<void> {
    // Implementation for loading messages
    return Promise.resolve();
  }




  async selectMember(member: UserModel) {
    this.selectedMember = member;
    this.openDirectMessage(member);
  }

  openDirectMessage(member: UserModel) {
    // Switch to direct message mode
    this.isDirectMessageMode = true;
    this.directMessageUser = member;
    this.currentChannel = null; // Clear current channel
    this.messages = []; // Clear channel messages
    
    // Load direct message history
    this.loadDirectMessages(member.primaryId);
  }

  async loadDirectMessages(targetUserId: string) {
    this.isLoading = true;
    try {
      // This would call your backend API to get DM history
      const dmHistory = await this.messageService.getDirectMessages(
        this.currentUser!.primaryId,
        targetUserId
      ).toPromise() || [];
      
      this.directMessages = dmHistory;
    } catch (error) {
      console.error('Error loading direct messages:', error);
      this.directMessages = [];
    } finally {
      this.isLoading = false;
    }
  }

  // Send direct message
  // Update the sendDirectMessage method:
async sendDirectMessage(messageContent: string) {
  if (!this.directMessageUser || !messageContent.trim()) return;

  try {
    // Use the socket service to send direct message
    this.socketService.sendDirectMessage(
      this.directMessageUser.primaryId,
      messageContent.trim(),
      'text', // messageType
      " "    // imageUrl (null for text messages)
    );
    
    // Add to local messages immediately for optimistic update
    const newMessage = MessageModel.createTextMessage(
      messageContent,
      this.currentUser!.primaryId,
      'direct', // Use a special channel ID for DMs
      this.currentUser!.username,
      this.currentUser!.profileImage || '',
      this.currentUser!.roles || []
    );
    
    this.directMessages = [...this.directMessages, newMessage];
  } catch (error) {
    console.error('Error sending direct message:', error);
  }
}

  // Exit direct message mode and return to channel view
  exitDirectMessage() {
    this.isDirectMessageMode = false;
    this.directMessageUser = null;
    this.directMessages = [];
    this.selectedMember = null;
  }

  // Modify the existing onSendMessage to handle both channel and DM
  onSendMessage(messageContent: string) {
    if (this.isDirectMessageMode && this.directMessageUser) {
      this.sendDirectMessage(messageContent);
    } else if (this.currentChannel) {
      // Original channel message sending
      const channelId = this.currentChannel.primaryId;
      if (!channelId) return;

      const messageData = {
        channelId: channelId,
        content: messageContent,
        messageType: 'text' as const,
        imageUrl:'htuiiu'
      };

      this.socketService.sendMessage(messageData);
      this.messageService.sendMessage(messageData)
    }
  }

  // Update message loading to handle DMs
  onChannelHistoryLoaded(messages: MessageModel[]) {
    if (this.isDirectMessageMode) {
      this.directMessages = messages;
    } else {
      this.messages = messages;
    }
  }
}