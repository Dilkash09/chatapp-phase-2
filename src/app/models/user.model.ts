export interface User {
  // MongoDB properties
  _id?: string;
  // Legacy properties
  id?: string;
  
  // Core user properties
  username: string;
  email: string;
  password?: string; // Hashed
  
  // Roles and permissions
  roles: string[];
  groups: string[];
  
  // Profile
  profileImage?: string;
  
  // Real-time features
  peerId?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  
  // Authentication
  token?: string;
}

export class UserModel implements User {
  constructor(
    // MongoDB ID
    public _id?: string,
    // Legacy ID
    public id?: string,
    
    // Core properties
    public username: string = '',
    public email: string = '',
    public password?: string,
    
    // Roles and permissions
    public roles: string[] = ['user'],
    public groups: string[] = [],
    
    // Profile
    public profileImage?: string,
    
    // Real-time features
    public peerId?: string,
    public isOnline: boolean = false,
    public lastSeen?: Date,
    
    // Metadata
    public createdAt?: Date,
    public updatedAt?: Date,
    
    // Authentication
    public token?: string
  ) {}

  // Get the primary ID (prefer MongoDB _id, fallback to legacy id)
  get primaryId(): string {
    return this._id || this.id || '';
  }

  // Role checking
  hasRole(role: string): boolean {
    return this.roles.includes(role);
  }

  isSuperAdmin(): boolean {
    return this.hasRole('super_admin');
  }

  isGroupAdmin(): boolean {
    return this.hasRole('group_admin');
  }

  isRegularUser(): boolean {
    return this.roles.length === 1 && this.roles[0] === 'user';
  }

  // Group management
  isMemberOfGroup(groupId: string): boolean {
    return this.groups.includes(groupId);
  }

  addToGroup(groupId: string): void {
    if (!this.isMemberOfGroup(groupId)) {
      this.groups.push(groupId);
    }
  }

  removeFromGroup(groupId: string): void {
    const index = this.groups.indexOf(groupId);
    if (index > -1) {
      this.groups.splice(index, 1);
    }
  }

  // Online status
  setOnlineStatus(online: boolean): void {
    this.isOnline = online;
    this.lastSeen = new Date();
  }

  // Convert to JSON for API calls
  toJSON(): any {
    return {
      // Prefer MongoDB _id for new data
      ...(this._id && { _id: this._id }),
      ...(this.id && { id: this.id }),
      
      username: this.username,
      email: this.email,
      ...(this.password && { password: this.password }),
      
      roles: this.roles,
      groups: this.groups,
      
      ...(this.profileImage && { profileImage: this.profileImage }),
      ...(this.peerId && { peerId: this.peerId }),
      isOnline: this.isOnline,
      ...(this.lastSeen && { lastSeen: this.lastSeen }),
      ...(this.createdAt && { createdAt: this.createdAt }),
      ...(this.updatedAt && { updatedAt: this.updatedAt }),
      ...(this.token && { token: this.token })
    };
  }

  // Create from JSON with support for both MongoDB and legacy data
  static fromJSON(json: any): UserModel {
    return new UserModel(
      json._id, // MongoDB ID
      json.id, // Legacy ID
      json.username,
      json.email,
      json.password,
      json.roles || ['user'],
      json.groups || [],
      json.profileImage,
      json.peerId,
      json.isOnline || false,
      json.lastSeen ? new Date(json.lastSeen) : undefined,
      json.createdAt ? new Date(json.createdAt) : undefined,
      json.updatedAt ? new Date(json.updatedAt) : undefined,
      json.token
    );
  }

  // Create a minimal user for display purposes
  static createBasicUser(username: string, email: string, id?: string): UserModel {
    return new UserModel(
      undefined, // _id
      id, // legacy id
      username,
      email,
      undefined, // no password
      ['user'], // default role
      [], // no groups
      undefined, // no profile image
      undefined, // no peerId
      false, // offline
      new Date(), // last seen now
      new Date(), // created now
      new Date() // updated now
    );
  }

  // Create from authentication response
  static fromAuthResponse(data: any): UserModel {
    return UserModel.fromJSON({
      _id: data.user?._id || data._id,
      id: data.user?.id || data.id,
      username: data.user?.username || data.username,
      email: data.user?.email || data.email,
      roles: data.user?.roles || data.roles,
      groups: data.user?.groups || data.groups,
      profileImage: data.user?.profileImage || data.profileImage,
      peerId: data.user?.peerId || data.peerId,
      isOnline: data.user?.isOnline || data.isOnline,
      lastSeen: data.user?.lastSeen || data.lastSeen,
      createdAt: data.user?.createdAt || data.createdAt,
      token: data.token
    });
  }

  // Check if user can perform admin actions
  canManageGroup(group: any): boolean {
    return this.isSuperAdmin() || 
           (this.isGroupAdmin() && group.createdBy === this.primaryId);
  }

  // Check if user can moderate channel
  canModerateChannel(channel: any, group: any): boolean {
    return this.isSuperAdmin() || 
           this.canManageGroup(group) ||
           (this.isGroupAdmin() && group.admins?.includes(this.primaryId));
  }

  // Get display name (username with role indicator)
  getDisplayName(): string {
    if (this.isSuperAdmin()) {
      return `${this.username} 👑`;
    } else if (this.isGroupAdmin()) {
      return `${this.username} ⚡`;
    }
    return this.username;
  }

  // Get initials for avatar
  getInitials(): string {
    return this.username
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}