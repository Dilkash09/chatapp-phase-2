// config/database.js
const { MongoClient, ObjectId } = require('mongodb');
const { ROLES } = require('../utils/constants');

class Database {
    constructor() {
        this.client = null;
        this.db = null;
        this.isConnected = false;
        
        // MongoDB collections
        this.users = null;
        this.groups = null;
        this.channels = null;
        this.messages = null;
        
        // MongoDB connection string
        this.connectionString = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        this.dbName = process.env.DB_NAME || 'chat_app';
    }

    async connect() {
        try {
            this.client = new MongoClient(this.connectionString);
            await this.client.connect();
            this.db = this.client.db(this.dbName);
            
            // Initialize collections
            this.users = this.db.collection('users');
            this.groups = this.db.collection('groups');
            this.channels = this.db.collection('channels');
            this.messages = this.db.collection('messages');
            
            this.isConnected = true;
            console.log('Connected to MongoDB successfully');
            
            // Create indexes for better performance
            await this.createIndexes();
            
        } catch (error) {
            console.error('MongoDB connection error:', error);
            throw error;
        }
    }

    async createIndexes() {
        try {
            // Create unique index on username
            await this.users.createIndex({ username: 1 }, { unique: true });
            
            // Create indexes for groups
            await this.groups.createIndex({ name: 1 });
            await this.groups.createIndex({ createdBy: 1 });
            
            // Create indexes for channels
            await this.channels.createIndex({ groupId: 1 });
            await this.channels.createIndex({ name: 1, groupId: 1 }, { unique: true });
            
            // Create indexes for messages
            await this.messages.createIndex({ channelId: 1 });
            await this.messages.createIndex({ timestamp: -1 });
            await this.messages.createIndex({ senderId: 1 });
            
            console.log('Database indexes created successfully');
        } catch (error) {
            console.error('Error creating indexes:', error);
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.close();
                this.isConnected = false;
                console.log('Disconnected from MongoDB');
            }
        } catch (error) {
            console.error('Error disconnecting from MongoDB:', error);
        }
    }

    async initializeData() {
        try {
            if (!this.isConnected) {
                await this.connect();
            }

            // Check if super admin already exists
            const existingSuperAdmin = await this.users.findOne({ username: 'super' });
            if (!existingSuperAdmin) {
                // Create default super admin
                const superAdmin = {
                    username: 'super',
                    email: 'super@admin.com',
                    password: '123', // In production, this should be hashed
                    roles: [ROLES.SUPER_ADMIN],
                    groups: [],
                    profileImage: null,
                    peerId: null,
                    isOnline: false,
                    lastSeen: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const result = await this.users.insertOne(superAdmin);
                console.log('Default super admin created:', result.insertedId);

                // Create sample groups
                const generalGroup = {
                    name: 'General',
                    description: 'General discussion group',
                    createdBy: result.insertedId,
                    admins: [result.insertedId],
                    members: [result.insertedId],
                    channels: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const techGroup = {
                    name: 'Technology',
                    description: 'Tech enthusiasts group',
                    createdBy: result.insertedId,
                    admins: [result.insertedId],
                    members: [result.insertedId],
                    channels: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const groupResults = await this.groups.insertMany([generalGroup, techGroup]);
                const generalGroupId = groupResults.insertedIds[0];
                const techGroupId = groupResults.insertedIds[1];

                // Update super admin with groups
                await this.users.updateOne(
                    { _id: result.insertedId },
                    { 
                        $set: { 
                            groups: [generalGroupId, techGroupId],
                            updatedAt: new Date()
                        } 
                    }
                );

                // Create sample channels
                const welcomeChannel = {
                    name: 'welcome',
                    groupId: generalGroupId,
                    createdBy: result.insertedId,
                    description: 'Welcome channel for new users',
                    bannedUsers: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const randomChannel = {
                    name: 'random',
                    groupId: generalGroupId,
                    createdBy: result.insertedId,
                    description: 'Random discussions',
                    bannedUsers: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const jsChannel = {
                    name: 'javascript',
                    groupId: techGroupId,
                    createdBy: result.insertedId,
                    description: 'JavaScript discussions',
                    bannedUsers: [],
                    createdAt: new Date(),
                    updatedAt: new Date()
                };

                const channelResults = await this.channels.insertMany([welcomeChannel, randomChannel, jsChannel]);
                const welcomeChannelId = channelResults.insertedIds[0];

                // Update groups with channels
                await this.groups.updateOne(
                    { _id: generalGroupId },
                    { 
                        $set: { 
                            channels: [channelResults.insertedIds[0], channelResults.insertedIds[1]],
                            updatedAt: new Date()
                        } 
                    }
                );

                await this.groups.updateOne(
                    { _id: techGroupId },
                    { 
                        $set: { 
                            channels: [channelResults.insertedIds[2]],
                            updatedAt: new Date()
                        } 
                    }
                );

                // Create sample messages
                const welcomeMessage = {
                    channelId: welcomeChannelId,
                    senderId: result.insertedId,
                    content: 'Welcome to our chat application!',
                    messageType: 'text',
                    imageUrl: null,
                    timestamp: new Date(),
                    createdAt: new Date()
                };

                const secondMessage = {
                    channelId: welcomeChannelId,
                    senderId: result.insertedId,
                    content: 'This is a sample message',
                    messageType: 'text',
                    imageUrl: null,
                    timestamp: new Date(),
                    createdAt: new Date()
                };

                await this.messages.insertMany([welcomeMessage, secondMessage]);

                console.log('Database initialized with sample data');
                console.log('Default super admin: username: super, password: 123');
            } else {
                console.log('Database already initialized');
            }

        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    // User methods
    async findUser(query) {
        return await this.users.findOne(query);
    }

    async findUsers(query = {}, options = {}) {
        return await this.users.find(query, options).toArray();
    }

    async createUser(userData) {
        userData.createdAt = new Date();
        userData.updatedAt = new Date();
        const result = await this.users.insertOne(userData);
        return { ...userData, _id: result.insertedId };
    }

    async updateUser(userId, updateData) {
        updateData.updatedAt = new Date();
        return await this.users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateData }
        );
    }

    async deleteUser(userId) {
        return await this.users.deleteOne({ _id: new ObjectId(userId) });
    }

    // Group methods
    async findGroup(query) {
        return await this.groups.findOne(query);
    }

    async findGroups(query = {}, options = {}) {
        return await this.groups.find(query, options).toArray();
    }

    async createGroup(groupData) {
        groupData.createdAt = new Date();
        groupData.updatedAt = new Date();
        const result = await this.groups.insertOne(groupData);
        return { ...groupData, _id: result.insertedId };
    }

    async updateGroup(groupId, updateData) {
        updateData.updatedAt = new Date();
        return await this.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { $set: updateData }
        );
    }

    async deleteGroup(groupId) {
        return await this.groups.deleteOne({ _id: new ObjectId(groupId) });
    }

    // Channel methods
    async findChannel(query) {
        return await this.channels.findOne(query);
    }

    async findChannels(query = {}, options = {}) {
        return await this.channels.find(query, options).toArray();
    }

    async createChannel(channelData) {
        channelData.createdAt = new Date();
        channelData.updatedAt = new Date();
        const result = await this.channels.insertOne(channelData);
        return { ...channelData, _id: result.insertedId };
    }

    async updateChannel(channelId, updateData) {
        updateData.updatedAt = new Date();
        return await this.channels.updateOne(
            { _id: new ObjectId(channelId) },
            { $set: updateData }
        );
    }

    async deleteChannel(channelId) {
        return await this.channels.deleteOne({ _id: new ObjectId(channelId) });
    }

    // Message methods
    async findMessage(query) {
        return await this.messages.findOne(query);
    }

    async findMessages(query = {}, options = {}) {
        const defaultOptions = { sort: { timestamp: -1 } };
        const finalOptions = { ...defaultOptions, ...options };
        return await this.messages.find(query, finalOptions).toArray();
    }

    async createMessage(messageData) {
        messageData.timestamp = new Date();
        messageData.createdAt = new Date();
        const result = await this.messages.insertOne(messageData);
        return { ...messageData, _id: result.insertedId };
    }

    async getChannelMessages(channelId, limit = 50) {
        return await this.messages
            .find({ channelId: new ObjectId(channelId) })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
    }

    async deleteMessage(messageId) {
        return await this.messages.deleteOne({ _id: new ObjectId(messageId) });
    }

    // Helper methods
    async getUserGroups(userId) {
        const user = await this.users.findOne({ _id: new ObjectId(userId) });
        if (!user || !user.groups || user.groups.length === 0) {
            return [];
        }
        
        return await this.groups.find({ 
            _id: { $in: user.groups.map(id => new ObjectId(id)) } 
        }).toArray();
    }

    async getGroupChannels(groupId) {
        return await this.channels.find({ groupId: new ObjectId(groupId) }).toArray();
    }

    async addUserToGroup(userId, groupId) {
        // Add user to group members
        await this.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { $addToSet: { members: new ObjectId(userId) } }
        );

        // Add group to user's groups
        await this.users.updateOne(
            { _id: new ObjectId(userId) },
            { $addToSet: { groups: new ObjectId(groupId) } }
        );
    }

    async removeUserFromGroup(userId, groupId) {
        // Remove user from group members
        await this.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { $pull: { members: new ObjectId(userId) } }
        );

        // Remove group from user's groups
        await this.users.updateOne(
            { _id: new ObjectId(userId) },
            { $pull: { groups: new ObjectId(groupId) } }
        );
    }

    async isUserInGroup(userId, groupId) {
        const group = await this.groups.findOne({ 
            _id: new ObjectId(groupId),
            members: new ObjectId(userId)
        });
        return group !== null;
    }

    async canUserAccessChannel(userId, channelId) {
        const channel = await this.channels.findOne({ _id: new ObjectId(channelId) });
        if (!channel) return false;

        return await this.isUserInGroup(userId, channel.groupId);
    }
    async findUser(query) {
    return await this.users.findOne(query);
}
// Get all channels a user has access to
async getUserChannels(userId) {
  try {
    if (!ObjectId.isValid(userId)) {
      return [];
    }

    const user = await this.users.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return [];
    }

    // If user is super admin, return all channels
    if (user.roles && user.roles.includes('super_admin')) {
      return await this.channels.find({}).toArray();
    }

    // Get channels where user is a member via groups
    const userGroups = await this.groups.find({
      members: userId
    }).toArray();

    const groupIds = userGroups.map(group => group._id.toString());

    // Get channels that belong to user's groups OR have user as direct member
    const userChannels = await this.channels.find({
      $or: [
        { groupId: { $in: groupIds } },
        { members: userId }
      ]
    }).toArray();

    return userChannels;
  } catch (error) {
    console.error('Error getting user channels:', error);
    return [];
  }
}

async updateUser(userId, updateData) {
    updateData.updatedAt = new Date();
    return await this.users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
    );
}


}

// Export a single instance of the Database class
module.exports = new Database();