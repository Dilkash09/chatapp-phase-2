const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');
const { ObjectId } = require('mongodb');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const messageRoutes = require('./routes/messages');
const uploadRoutes = require('./routes/uploads');

// Import middleware
const { authenticateToken } = require('./middleware/auth');

// Import MongoDB database
const db = require('./config/database');

const app = express();
const server = http.createServer(app);

// Socket.io configuration
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// PeerJS Server configuration
const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    debug: true,
    allow_discovery: true,
    proxied: process.env.NODE_ENV === 'production',
    ssl: process.env.NODE_ENV === 'production' ? {} : undefined,
    corsOptions: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// PeerJS server event handlers
peerServer.on('connection', async (client) => {
    console.log('Peer connected:', client.getId());
    
    // Store peer connection info in database
    try {
        const user = await db.findUser({ peerId: client.getId() });
        if (user) {
            await db.updateUser(user._id, {
                isOnline: true,
                lastSeen: new Date()
            });
            console.log(`User ${user.username} (${user._id}) connected with Peer ID: ${client.getId()}`);
        }
    } catch (error) {
        console.error('Error updating user peer connection:', error);
    }
});

peerServer.on('disconnect', async (client) => {
    console.log('Peer disconnected:', client.getId());
    
    // Update user status in database
    try {
        const user = await db.findUser({ peerId: client.getId() });
        if (user) {
            await db.updateUser(user._id, {
                isOnline: false,
                lastSeen: new Date()
            });
            console.log(`User ${user.username} (${user._id}) disconnected from Peer server`);
        }
    } catch (error) {
        console.error('Error updating user peer disconnection:', error);
    }
});

peerServer.on('error', (error) => {
    console.error('Peer server error:', error);
});

peerServer.on('message', (client, message) => {
    console.log('Peer message from', client.getId(), ':', message);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../client/public')));
// In server.js - update static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Set proper headers for images
    if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));
// In server.js, update the static file serving:


// Use PeerJS server
app.use('/peerjs', peerServer);

// Initialize database
db.initializeData().then(() => {
    console.log('Database initialization complete');
}).catch(error => {
    console.error('Database initialization failed:', error);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/channels', messageRoutes);
app.use('/api/upload', uploadRoutes);
// In server.js - update the routes section
app.use('/api/messages', messageRoutes); // This should point to your new messages.js
// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            database: db.isConnected ? 'connected' : 'disconnected',
            peerServer: 'running',
            socketIo: 'running'
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message 
        });
    }
});

// PeerJS status endpoint
app.get('/api/peer/status', (req, res) => {
    res.json({
        peerServer: 'active',
        path: '/peerjs',
        discovery: true,
        ssl: process.env.NODE_ENV === 'production'
    });
});

// Socket.io for real-time communication
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // User authentication for socket
    socket.on('authenticate', async (data) => {
        try {
            const user = await db.findUser({ _id: new ObjectId(data.userId) });
            if (user) {
                socket.userId = user._id.toString();
                socket.username = user.username;
                socket.roles = user.roles;
                
                // Store peer ID if provided
                if (data.peerId) {
                    await db.updateUser(user._id, { 
                        peerId: data.peerId, 
                        isOnline: true,
                        lastSeen: new Date()
                    });
                    console.log(`User ${user.username} authenticated with Peer ID: ${data.peerId}`);
                }
                
                socket.emit('authenticated', { success: true });
                console.log(`User ${user.username} authenticated for socket communication`);
            } else {
                socket.emit('authenticated', { success: false, error: 'Authentication failed' });
            }
        } catch (error) {
            console.error('Socket authentication error:', error);
            socket.emit('authenticated', { success: false, error: 'Authentication error' });
        }
    });
    
    // Join a channel room
    socket.on('join-channel', async (data) => {
        if (!socket.userId) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        try {
            // Check if user can access the channel
            const canAccess = await db.canUserAccessChannel(socket.userId, data.channelId);
            if (!canAccess) {
                socket.emit('error', { message: 'Access denied to channel' });
                return;
            }
            
            socket.join(data.channelId);
            socket.currentChannel = data.channelId;
            
            // Send channel history
            const channelMessages = await db.getChannelMessages(data.channelId, 20);
            socket.emit('channel-history', channelMessages.reverse());
            
            // Notify others in the channel
            socket.to(data.channelId).emit('user-joined', {
                userId: socket.userId,
                username: socket.username,
                channelId: data.channelId,
                timestamp: new Date()
            });
            
            console.log(`User ${socket.username} joined channel ${data.channelId}`);
        } catch (error) {
            console.error('Error joining channel:', error);
            socket.emit('error', { message: 'Failed to join channel' });
        }
    });
    
    // Leave a channel room
    socket.on('leave-channel', (data) => {
        if (socket.currentChannel) {
            socket.leave(socket.currentChannel);
            
            // Notify others in the channel
            socket.to(socket.currentChannel).emit('user-left', {
                userId: socket.userId,
                username: socket.username,
                channelId: socket.currentChannel,
                timestamp: new Date()
            });
            
            console.log(`User ${socket.username} left channel ${socket.currentChannel}`);
            socket.currentChannel = null;
        }
    });
    
    // Handle new messages
    // In server.js - inside socket.io connection handler
socket.on('send-message', async (data) => {
    try {
        if (!socket.userId) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        const { channelId, content, messageType = 'text', imageUrl } = data;
        
        console.log('Received message via socket:', {
            channelId,
            content,
            messageType,
            imageUrl,
            userId: socket.userId
        });

        // Verify user has access to this channel
        const canAccess = await db.canUserAccessChannel(socket.userId, channelId);
        if (!canAccess) {
            socket.emit('error', { message: 'Access denied to channel' });
            return;
        }
        
        const user = await db.users.findOne({ _id: new ObjectId(socket.userId) });
        if (!user) {
            socket.emit('error', { message: 'User not found' });
            return;
        }

        // Create new message in MongoDB
        const newMessage = {
            channelId: new ObjectId(channelId),
            senderId: new ObjectId(socket.userId),
            content: content,
            messageType: messageType,
            imageUrl: imageUrl || null,
            timestamp: new Date(),
            createdAt: new Date()
        };

        console.log('Saving message to database:', newMessage);

        const result = await db.messages.insertOne(newMessage);
        
        console.log('Message saved to database with ID:', result.insertedId);

        // Get the created message with user info
        const createdMessage = await db.messages.findOne({ 
            _id: result.insertedId 
        });
        
        if (!createdMessage) {
            throw new Error('Failed to retrieve created message');
        }

        // Prepare message data for broadcast
        const messageData = {
            _id: createdMessage._id,
            id: createdMessage._id.toString(),
            channelId: createdMessage.channelId,
            senderId: createdMessage.senderId,
            content: createdMessage.content,
            messageType: createdMessage.messageType,
            imageUrl: createdMessage.imageUrl,
            timestamp: createdMessage.timestamp,
            username: user.username,
            userRoles: user.roles || [],
            profileImage: user.profileImage
        };

        console.log('Broadcasting message to channel:', channelId);
        
        // Broadcast to all users in the channel
        io.to(channelId).emit('new-message', messageData);
        
        console.log(`Message saved and broadcast successfully`);

    } catch (error) {
        console.error('Error handling message via socket:', error);
        socket.emit('error', { message: 'Failed to send message: ' + error.message });
    }
});

// In server.js - add direct message handler
socket.on('send-direct-message', async (data) => {
    try {
        if (!socket.userId) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        
        const { targetUserId, content, messageType = 'text' } = data;
        
        console.log('Received direct message:', {
            from: socket.userId,
            to: targetUserId,
            content,
            messageType
        });

        // Verify target user exists
        const targetUser = await db.users.findOne({ _id: new ObjectId(targetUserId) });
        if (!targetUser) {
            socket.emit('error', { message: 'Target user not found' });
            return;
        }

        const senderUser = await db.users.findOne({ _id: new ObjectId(socket.userId) });
        if (!senderUser) {
            socket.emit('error', { message: 'Sender user not found' });
            return;
        }

        // Create direct message in MongoDB
        const directMessage = {
            senderId: new ObjectId(socket.userId),
            receiverId: new ObjectId(targetUserId),
            content: content,
            messageType: messageType,
            timestamp: new Date(),
            createdAt: new Date()
        };

        console.log('Saving direct message to database:', directMessage);

        const result = await db.messages.insertOne(directMessage);
        
        console.log('Direct message saved with ID:', result.insertedId);

        // Prepare message data
        const messageData = {
            _id: result.insertedId,
            id: result.insertedId.toString(),
            senderId: new ObjectId(socket.userId),
            receiverId: new ObjectId(targetUserId),
            content: content,
            messageType: messageType,
            timestamp: new Date(),
            username: senderUser.username,
            userRoles: senderUser.roles || [],
            profileImage: senderUser.profileImage
        };

        // Send to sender
        socket.emit('direct-message', messageData);
        
        // Send to receiver if online
        const targetSocket = await findSocketByUserId(targetUserId);
        if (targetSocket) {
            targetSocket.emit('direct-message', messageData);
        }
        
        console.log('Direct message sent successfully');

    } catch (error) {
        console.error('Error handling direct message:', error);
        socket.emit('error', { message: 'Failed to send direct message: ' + error.message });
    }
});
    
    // Video call signaling
    socket.on('video-call-signal', async (data) => {
        try {
            const { targetUserId, signal, callType } = data;
            
            // Find target user's socket
            const targetSocket = await findSocketByUserId(targetUserId);
            if (targetSocket) {
                targetSocket.emit('video-call-signal', {
                    fromUserId: socket.userId,
                    fromUsername: socket.username,
                    signal: signal,
                    callType: callType
                });
                console.log(`Video call signal sent from ${socket.username} to user ${targetUserId}`);
            } else {
                socket.emit('error', { message: 'User not available for video call' });
            }
        } catch (error) {
            console.error('Video call signaling error:', error);
            socket.emit('error', { message: 'Failed to send video call signal' });
        }
    });
    
    // Video call response
    socket.on('video-call-response', async (data) => {
        try {
            const { targetUserId, accepted, signal } = data;
            
            const targetSocket = await findSocketByUserId(targetUserId);
            if (targetSocket) {
                targetSocket.emit('video-call-response', {
                    fromUserId: socket.userId,
                    fromUsername: socket.username,
                    accepted: accepted,
                    signal: signal
                });
                console.log(`Video call response sent from ${socket.username} to user ${targetUserId}`);
            }
        } catch (error) {
            console.error('Video call response error:', error);
        }
    });
    
    // End video call
    socket.on('end-video-call', async (data) => {
        try {
            const { targetUserId } = data;
            
            const targetSocket = await findSocketByUserId(targetUserId);
            if (targetSocket) {
                targetSocket.emit('video-call-ended', {
                    fromUserId: socket.userId,
                    fromUsername: socket.username
                });
                console.log(`Video call ended by ${socket.username} with user ${targetUserId}`);
            }
        } catch (error) {
            console.error('End video call error:', error);
        }
    });
    
    // Get online users in channel
    socket.on('get-online-users', (data) => {
        const { channelId } = data;
        const onlineUsers = getOnlineUsersInChannel(channelId);
        socket.emit('online-users', { channelId, users: onlineUsers });
    });
    
    // User typing indicator
    socket.on('typing-start', (data) => {
        if (socket.currentChannel) {
            socket.to(socket.currentChannel).emit('user-typing', {
                userId: socket.userId,
                username: socket.username,
                channelId: socket.currentChannel,
                typing: true
            });
        }
    });
    
    socket.on('typing-stop', (data) => {
        if (socket.currentChannel) {
            socket.to(socket.currentChannel).emit('user-typing', {
                userId: socket.userId,
                username: socket.username,
                channelId: socket.currentChannel,
                typing: false
            });
        }
    });
    
    socket.on('disconnect', async () => {
        // Notify if user was in a channel
        if (socket.currentChannel) {
            socket.to(socket.currentChannel).emit('user-left', {
                userId: socket.userId,
                username: socket.username,
                channelId: socket.currentChannel,
                timestamp: new Date(),
                reason: 'disconnected'
            });
        }
        
        // Update user online status in database
        if (socket.userId) {
            try {
                await db.updateUser(socket.userId, { 
                    isOnline: false, 
                    lastSeen: new Date() 
                });
            } catch (error) {
                console.error('Error updating user status on disconnect:', error);
            }
        }
        
        console.log('User disconnected:', socket.id, socket.username || 'Unknown');
    });
});

// Helper function to find socket by user ID
async function findSocketByUserId(userId) {
    try {
        const sockets = io.sockets.sockets;
        for (let [id, socket] of sockets) {
            if (socket.userId === userId) {
                return socket;
            }
        }
        return null;
    } catch (error) {
        console.error('Error finding socket by user ID:', error);
        return null;
    }
}

// Helper function to get online users in a channel
function getOnlineUsersInChannel(channelId) {
    try {
        const channelSockets = io.sockets.adapter.rooms.get(channelId);
        if (!channelSockets) return [];
        
        const onlineUsers = [];
        for (let socketId of channelSockets) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket && socket.userId) {
                onlineUsers.push({
                    userId: socket.userId,
                    username: socket.username,
                    roles: socket.roles
                });
            }
        }
        return onlineUsers;
    } catch (error) {
        console.error('Error getting online users:', error);
        return [];
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`PeerJS server running on /peerjs`);
    console.log(`Socket.IO server running`);
    console.log(`MongoDB ${db.isConnected ? 'connected' : 'disconnected'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await db.disconnect();
    process.exit(0);
});

module.exports = { app, io, peerServer };