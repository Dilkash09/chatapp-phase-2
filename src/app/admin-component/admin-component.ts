// admin-component.ts - Enhanced version with better group management
import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserModel } from '../models/user.model';
import { GroupModel } from '../models/group.model';
import { ChannelModel } from '../models/channel.model';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { GroupService } from '../services/group.service';
import { ChannelService } from '../services/channel.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.css'
})
export class AdminComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private groupService = inject(GroupService);
  private channelService = inject(ChannelService);
  private router = inject(Router);

  activeTab = 'users';
  users: UserModel[] = [];
  groups: GroupModel[] = [];
  channels: Array<ChannelModel & { groupName: string }> = [];
  isLoading = false;

  // Modal properties
  showGroupModal = false;
  modalTitle = '';
  modalAction: 'add' | 'remove' | 'view' | 'addMultiple' = 'add';
  selectedUser: UserModel | null = null;
  selectedGroupId = '';
  availableGroups: GroupModel[] = [];
  userGroups: { [userId: string]: string[] } = {};
  
  // Multiple users selection
  selectedUsers: Set<string> = new Set();
  bulkGroupId = '';
  
  // Search and filtering
  userSearchTerm = '';
  filteredUsers: UserModel[] = [];

  // Current user
  currentUser: UserModel | null = null;
  
  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    if (!this.currentUser || !this.hasRole('super_admin')) {
      this.router.navigate(['/dashboard']);
      return;
    }
    this.loadData();
  }

  // Public methods for template access
  hasRole(role: string): boolean {
    return this.authService.hasRole(role);
  }

  async loadData() {
    this.isLoading = true;
    try {
      if (this.hasRole('super_admin')) {
        await this.loadUsers();
        await this.loadUserGroups();
      }
      await this.loadGroups();
      await this.loadChannels();
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      this.isLoading = false;
    }
  }
  
  async loadUsers() {
    try {
      this.users = await this.userService.getAllUsers().toPromise() || [];
      this.filteredUsers = this.users;
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  async loadGroups() {
    try {
      this.groups = await this.groupService.getAllGroups().toPromise() || [];
      
      // Filter groups for non-super admins
      if (!this.hasRole('super_admin')) {
        this.groups = this.groups.filter(group => 
          group.createdBy === this.currentUser?.primaryId
        );
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  }

  async loadChannels() {
    try {
      const allGroups = await this.groupService.getAllGroups().toPromise() || [];
      this.channels = [];

      for (const group of allGroups) {
        if (this.hasRole('super_admin') || group.createdBy === this.currentUser?.primaryId) {
          const groupChannels = await this.channelService.getChannelsForGroup(group.primaryId).toPromise() || [];
          // Map to ChannelModel instances with groupName
          const channelsWithGroupName = groupChannels.map(channel => {
            const channelModel = ChannelModel.fromJSON(channel);
            return Object.assign(channelModel, { groupName: group.name });
          });
          this.channels = [...this.channels, ...channelsWithGroupName];
        }
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  }

  async loadUserGroups() {
    this.userGroups = {};
    
    for (const user of this.users) {
      if (user.primaryId !== this.currentUser?.primaryId) {
        try {
          const userGroups = await this.userService.getUserGroups(user.primaryId).toPromise() || [];
          this.userGroups[user.primaryId] = userGroups;
        } catch (error) {
          console.error(`Error loading groups for user ${user.username}:`, error);
          this.userGroups[user.primaryId] = [];
        }
      }
    }
  }

  // Search and filtering
  filterUsers() {
    if (!this.userSearchTerm) {
      this.filteredUsers = this.users;
    } else {
      const searchTerm = this.userSearchTerm.toLowerCase();
      this.filteredUsers = this.users.filter(user =>
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm)
      );
    }
  }

  // User selection for bulk operations
  toggleUserSelection(userId: string) {
    if (this.selectedUsers.has(userId)) {
      this.selectedUsers.delete(userId);
    } else {
      this.selectedUsers.add(userId);
    }
  }

  isUserSelected(userId: string): boolean {
    return this.selectedUsers.has(userId);
  }

  getSelectedUsersCount(): number {
    return this.selectedUsers.size;
  }

  clearSelection() {
    this.selectedUsers.clear();
  }

  selectAllUsers() {
    this.filteredUsers.forEach(user => {
      if (user.primaryId !== this.currentUser?.primaryId) {
        this.selectedUsers.add(user.primaryId);
      }
    });
  }

  // Statistics
  getAdminCount(): number {
    return this.users.filter(user => 
      user.hasRole('super_admin') || user.hasRole('group_admin')
    ).length;
  }

  getTotalMembers(): number {
    return this.groups.reduce((total, group) => total + group.members.length, 0);
  }

  getUsername(userId: string): string {
    const user = this.users.find(u => u.primaryId === userId);
    return user ? user.username : 'Unknown User';
  }

  // Modal methods
  viewUserGroups(user: UserModel) {
    this.selectedUser = user;
    this.modalAction = 'view';
    this.modalTitle = `${user.username}'s Groups`;
    this.showGroupModal = true;
  }

  viewGroupMembers(group: GroupModel) {
    const memberNames = group.members.map(memberId => this.getUsername(memberId)).join('\n');
    alert(`View members of group: ${group.name}\nMembers:\n${memberNames}`);
  }

  editGroup(group: GroupModel) {
    const newName = prompt('Enter new group name:', group.name);
    if (newName && newName !== group.name) {
      this.groupService.updateGroup(group.primaryId, { name: newName }).subscribe({
        next: () => {
          this.loadGroups();
          alert(`Group renamed to "${newName}"`);
        },
        error: (error) => {
          alert('Failed to update group: ' + (error.error?.error || error.message));
        }
      });
    }
  }

  editChannel(channel: ChannelModel & { groupName: string }) {
    const newName = prompt('Enter new channel name:', channel.name);
    if (newName && newName !== channel.name) {
      this.channelService.updateChannel(channel.primaryId, { name: newName }).subscribe({
        next: () => {
          this.loadChannels();
          alert(`Channel renamed to "${newName}"`);
        },
        error: (error) => {
          alert('Failed to update channel: ' + (error.error?.error || error.message));
        }
      });
    }
  }

  removeUserFromGroupDirect(groupId: string, user: UserModel) {
    if (confirm(`Remove ${user.username} from ${this.getGroupName(groupId)}?`)) {
      this.groupService.removeUserFromGroup(groupId, user.primaryId).subscribe({
        next: () => {
          this.loadUserGroups();
          alert('User removed from group');
        },
        error: (error) => {
          alert('Failed to remove user: ' + (error.error?.error || error.message));
        }
      });
    }
  }

  selectTab(tab: string) {
    this.activeTab = tab;
    this.clearSelection(); // Clear selection when switching tabs
  }

  async promoteUser(user: UserModel) {
    if (!confirm(`Promote ${user.username} to group admin?`)) return;

    try {
      await this.userService.promoteUser(user.primaryId).toPromise();
      await this.loadUsers();
      alert('User promoted to group admin');
    } catch (error: any) {
      alert('Failed to promote user: ' + (error.error?.error || error.message));
    }
  }

  async deleteUser(user: UserModel) {
    if (!confirm(`Are you sure you want to delete ${user.username}?`)) return;

    try {
      await this.userService.deleteUser(user.primaryId).toPromise();
      await this.loadUsers();
      alert('User deleted successfully');
    } catch (error: any) {
      alert('Failed to delete user: ' + (error.error?.error || error.message));
    }
  }

  async deleteGroup(group: GroupModel) {
    if (!confirm(`Are you sure you want to delete "${group.name}"? All channels and messages will be deleted.`)) return;

    try {
      await this.groupService.deleteGroup(group.primaryId).toPromise();
      await this.loadGroups();
      await this.loadChannels();
      alert('Group deleted successfully');
    } catch (error: any) {
      alert('Failed to delete group: ' + (error.error?.error || error.message));
    }
  }

  async deleteChannel(channel: ChannelModel & { groupName: string }) {
    if (!confirm(`Are you sure you want to delete "${channel.name}"? All messages will be deleted.`)) return;

    try {
      await this.channelService.deleteChannel(channel.primaryId).toPromise();
      await this.loadChannels();
      alert('Channel deleted successfully');
    } catch (error: any) {
      alert('Failed to delete channel: ' + (error.error?.error || error.message));
    }
  }

  async createNewGroup() {
    const groupName = prompt('Enter name for new group:');
    if (!groupName) return;

    const groupDescription = prompt('Enter description for new group:') || '';

    try {
      await this.groupService.createGroup(groupName, groupDescription).toPromise();
      await this.loadGroups();
      alert(`Group "${groupName}" created successfully`);
    } catch (error: any) {
      alert('Failed to create group: ' + (error.error?.error || error.message));
    }
  }

  async createNewChannel() {
    let availableGroups = this.groups;
    
    if (availableGroups.length === 0) {
      alert('You need to create a group first before creating channels');
      return;
    }

    const groupNames = availableGroups.map(g => g.name).join('\n');
    const groupName = prompt(`Available groups:\n${groupNames}\n\nEnter the group name where you want to create the channel:`);
    
    if (!groupName) return;

    const selectedGroup = availableGroups.find(g => g.name === groupName);
    if (!selectedGroup) {
      alert('Group not found');
      return;
    }

    const channelName = prompt('Enter name for new channel:');
    if (!channelName) return;

    try {
      await this.channelService.createChannel(selectedGroup.primaryId, channelName).toPromise();
      await this.loadChannels();
      alert(`Channel "${channelName}" created successfully`);
    } catch (error: any) {
      alert('Failed to create channel: ' + (error.error?.error || error.message));
    }
  }

  // Group management methods
  openAddToGroupModal(user: UserModel) {
    this.selectedUser = user;
    this.modalAction = 'add';
    this.modalTitle = `Add ${user.username} to Group`;
    this.selectedGroupId = '';
    this.availableGroups = this.groups.filter(group => 
      !this.userGroups[user.primaryId]?.includes(group.primaryId)
    );
    this.showGroupModal = true;
  }

  openRemoveFromGroupModal(user: UserModel) {
    this.selectedUser = user;
    this.modalAction = 'remove';
    this.modalTitle = `Remove ${user.username} from Group`;
    this.selectedGroupId = '';
    this.showGroupModal = true;
  }

  // New method for bulk adding users to groups
  openBulkAddToGroupModal() {
    if (this.selectedUsers.size === 0) {
      alert('Please select at least one user first');
      return;
    }

    this.modalAction = 'addMultiple';
    this.modalTitle = `Add ${this.selectedUsers.size} Users to Group`;
    this.bulkGroupId = '';
    this.showGroupModal = true;
  }

  closeModal() {
    this.showGroupModal = false;
    this.selectedUser = null;
    this.selectedGroupId = '';
    this.bulkGroupId = '';
  }

  async confirmGroupAction() {
    if (!this.selectedUser && this.modalAction !== 'addMultiple') {
      alert('Please select a user');
      return;
    }

    if ((this.modalAction === 'add' || this.modalAction === 'remove') && !this.selectedGroupId) {
      alert('Please select a group');
      return;
    }

    if (this.modalAction === 'addMultiple' && !this.bulkGroupId) {
      alert('Please select a group');
      return;
    }

    try {
      if (this.modalAction === 'add') {
        await this.groupService.addUserToGroup(this.selectedGroupId, this.selectedUser!.primaryId).toPromise();
        alert(`User ${this.selectedUser!.username} added to group successfully`);
      } 
      else if (this.modalAction === 'remove') {
        await this.groupService.removeUserFromGroup(this.selectedGroupId, this.selectedUser!.primaryId).toPromise();
        alert(`User ${this.selectedUser!.username} removed from group successfully`);
      }
      else if (this.modalAction === 'addMultiple') {
        const userIds = Array.from(this.selectedUsers);
        let successCount = 0;
        
        for (const userId of userIds) {
          try {
            await this.groupService.addUserToGroup(this.bulkGroupId, userId).toPromise();
            successCount++;
          } catch (error) {
            console.error(`Failed to add user ${userId} to group:`, error);
          }
        }
        
        alert(`Successfully added ${successCount} out of ${userIds.length} users to group`);
        this.clearSelection();
      }
      
      await this.loadUserGroups();
      this.closeModal();
    } catch (error: any) {
      alert('Operation failed: ' + (error.error?.error || error.message));
    }
  }

  getGroupName(groupId: string): string {
    const group = this.groups.find(g => g.primaryId === groupId);
    return group ? group.name : 'Unknown Group';
  }

  // Helper methods for template
  getUserGroups(user: UserModel): string[] {
    return this.userGroups[user.primaryId] || [];
  }

  hasUserGroups(user: UserModel): boolean {
    return this.getUserGroups(user).length > 0;
  }

  getAvailableGroupsForUser(user: UserModel): GroupModel[] {
    const userGroupIds = this.getUserGroups(user);
    return this.groups.filter(group => !userGroupIds.includes(group.primaryId));
  }

  getRemovableGroupsForUser(user: UserModel): GroupModel[] {
    const userGroupIds = this.getUserGroups(user);
    return this.groups.filter(group => userGroupIds.includes(group.primaryId));
  }
  
  navigateToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}