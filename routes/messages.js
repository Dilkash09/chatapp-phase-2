const express = require('express');
const router = express.Router();
const database = require('../config/database'); // Import the database instance
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');




// Get all messages (with optional filters) - ACCESSIBLE TO ALL USERS WITH PROPER PERMISSIONS
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { 
            limit = 100, 
            offset = 0,
            channelId,
            userId,
            messageType,
            startDate,
            endDate 
        } = req.query;

        // Get current user
        const currentUser = await database.users.findOne({ 
            _id: new ObjectId(req.user.id) 
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build query filters
        const query = {};
        
        // If channelId is provided, verify user has access to that channel
        if (channelId && ObjectId.isValid(channelId)) {
            const canAccess = await database.canUserAccessChannel(req.user.id, channelId);
            if (!canAccess) {
                return res.status(403).json({ error: 'Access denied to this channel' });
            }
            query.channelId = new ObjectId(channelId);
        } else if (!userId) {
            // If no channelId or userId specified, get messages from channels user has access to
            const userChannels = await database.getUserChannels(req.user.id);
            const channelIds = userChannels.map(channel => new ObjectId(channel._id));
            
            if (channelIds.length === 0) {
                return res.json({
                    messages: [],
                    pagination: {
                        total: 0,
                        limit: parseInt(limit),
                        offset: parseInt(offset),
                        hasMore: false
                    }
                });
            }
            
            query.channelId = { $in: channelIds };
        }
        
        // If userId is provided, users can only see their own messages or messages in conversations they're part of
        if (userId && ObjectId.isValid(userId)) {
            const targetUserId = new ObjectId(userId);
            
            // Users can only filter by their own userId or see messages between themselves and others
            if (targetUserId.toString() !== req.user.id) {
                // For direct messages between two users
                query.$or = [
                    { 
                        senderId: new ObjectId(req.user.id),
                        receiverId: targetUserId
                    },
                    {
                        senderId: targetUserId,
                        receiverId: new ObjectId(req.user.id)
                    }
                ];
            } else {
                // User is filtering by their own ID
                query.senderId = targetUserId;
            }
        }
        
        if (messageType) {
            query.messageType = messageType;
        }
        
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        console.log('Fetching messages with query:', query);

        // Get messages from MongoDB
        const allMessages = await database.messages
            .find(query)
            .sort({ timestamp: -1 })
            .skip(parseInt(offset))
            .limit(parseInt(limit))
            .toArray();

        console.log(`Found ${allMessages.length} messages`);

        // Add user info to messages
        const messagesWithUserInfo = await Promise.all(
            allMessages.map(async (message) => {
                const user = await database.users.findOne({ 
                    _id: new ObjectId(message.senderId) 
                });
                
                // Get channel info if available
                let channelInfo = null;
                if (message.channelId) {
                    channelInfo = await database.channels.findOne({
                        _id: new ObjectId(message.channelId)
                    });
                }

                return {
                    _id: message._id,
                    id: message._id.toString(),
                    channelId: message.channelId,
                    channelName: channelInfo ? channelInfo.name : null,
                    senderId: message.senderId,
                    receiverId: message.receiverId, // Include receiverId for direct messages
                    content: message.content,
                    messageType: message.messageType || 'text',
                    imageUrl: message.imageUrl,
                    timestamp: message.timestamp,
                    username: user ? user.username : 'Unknown',
                    userRoles: user ? user.roles : [],
                    profileImage: user ? user.profileImage : null
                };
            })
        );

        // Get total count for pagination
        const totalCount = await database.messages.countDocuments(query);

        res.json({
            messages: messagesWithUserInfo,
            pagination: {
                total: totalCount,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + messagesWithUserInfo.length) < totalCount
            }
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get messages for a channel
router.get('/channel/:channelId', authenticateToken, async (req, res) => {
    try {
        const { channelId } = req.params;
        
        console.log('Fetching messages for channel:', channelId);
        
        if (!ObjectId.isValid(channelId)) {
            return res.status(400).json({ error: 'Invalid channel ID' });
        }

        // Check if user has access to this channel
        const canAccess = await database.canUserAccessChannel(req.user.id, channelId);
        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to channel' });
        }

        // Get messages from MongoDB
        const channelMessages = await database.messages
            .find({ channelId: new ObjectId(channelId) })
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();

        console.log(`Found ${channelMessages.length} messages for channel ${channelId}`);

        // Add user info to messages
        const messagesWithUserInfo = await Promise.all(
            channelMessages.map(async (message) => {
                const user = await database.users.findOne({ 
                    _id: new ObjectId(message.senderId) 
                });
                
                return {
                    _id: message._id,
                    id: message._id.toString(), // For compatibility
                    channelId: message.channelId,
                    senderId: message.senderId,
                    content: message.content,
                    messageType: message.messageType || 'text',
                    imageUrl: message.imageUrl,
                    timestamp: message.timestamp,
                    username: user ? user.username : 'Unknown',
                    userRoles: user ? user.roles : [],
                    profileImage: user ? user.profileImage : null
                };
            })
        );

        // Reverse to show oldest first
        const sortedMessages = messagesWithUserInfo.reverse();
        
        res.json(sortedMessages);
    } catch (error) {
        console.error('Error fetching channel messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get direct messages between two users
router.get('/direct/:userId1/:userId2', authenticateToken, async (req, res) => {
    try {
        const { userId1, userId2 } = req.params;
        
        console.log('Fetching direct messages between:', userId1, 'and', userId2);
        
        if (!ObjectId.isValid(userId1) || !ObjectId.isValid(userId2)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }

        // Verify the requesting user is one of the participants
        if (req.user.id !== userId1 && req.user.id !== userId2) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get direct messages from MongoDB
        // For direct messages, we might use a special channel ID or a different collection
        // This is a simple implementation - you might want to create a separate direct_messages collection
        const directMessages = await database.messages
            .find({
                $or: [
                    { 
                        senderId: new ObjectId(userId1),
                        receiverId: new ObjectId(userId2)
                    },
                    { 
                        senderId: new ObjectId(userId2),
                        receiverId: new ObjectId(userId1)
                    }
                ]
            })
            .sort({ timestamp: -1 })
            .limit(50)
            .toArray();

        console.log(`Found ${directMessages.length} direct messages`);

        // Add user info to messages
        const messagesWithUserInfo = await Promise.all(
            directMessages.map(async (message) => {
                const user = await database.users.findOne({ 
                    _id: new ObjectId(message.senderId) 
                });
                
                return {
                    _id: message._id,
                    id: message._id.toString(),
                    senderId: message.senderId,
                    receiverId: message.receiverId,
                    content: message.content,
                    messageType: message.messageType || 'text',
                    timestamp: message.timestamp,
                    username: user ? user.username : 'Unknown',
                    userRoles: user ? user.roles : [],
                    profileImage: user ? user.profileImage : null
                };
            })
        );

        const sortedMessages = messagesWithUserInfo.reverse();
        res.json(sortedMessages);
    } catch (error) {
        console.error('Error fetching direct messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/messages/direct - Create direct message
router.post('/direct', authenticateToken, async (req, res) => {
    try {
        const { targetUserId, content, messageType = 'text' } = req.body;
        
        console.log('Creating direct message:', { targetUserId, content, messageType });

        if (!targetUserId || !content) {
            return res.status(400).json({ error: 'Target user ID and content are required' });
        }

        if (!ObjectId.isValid(targetUserId)) {
            return res.status(400).json({ error: 'Invalid target user ID' });
        }

        // Verify target user exists
        const targetUser = await database.users.findOne({ 
            _id: new ObjectId(targetUserId) 
        });
        
        if (!targetUser) {
            return res.status(404).json({ error: 'Target user not found' });
        }

        // Verify sender user exists
        const senderUser = await database.users.findOne({ 
            _id: new ObjectId(req.user.id) 
        });
        
        if (!senderUser) {
            return res.status(404).json({ error: 'Sender user not found' });
        }

        // Create direct message in MongoDB
        const directMessage = {
            senderId: new ObjectId(req.user.id),
            receiverId: new ObjectId(targetUserId),
            content: content,
            messageType: messageType,
            timestamp: new Date(),
            createdAt: new Date()
        };

        console.log('Saving direct message to database:', directMessage);

        const result = await database.messages.insertOne(directMessage);
        
        console.log('Direct message saved with ID:', result.insertedId);

        // Get the created message with user info
        const createdMessage = await database.messages.findOne({ 
            _id: result.insertedId 
        });

        if (!createdMessage) {
            throw new Error('Failed to retrieve created message');
        }

        // Prepare response
        const responseMessage = {
            _id: createdMessage._id,
            id: createdMessage._id.toString(),
            senderId: createdMessage.senderId,
            receiverId: createdMessage.receiverId,
            content: createdMessage.content,
            messageType: createdMessage.messageType,
            timestamp: createdMessage.timestamp,
            username: senderUser.username,
            userRoles: senderUser.roles || [],
            profileImage: senderUser.profileImage
        };

        console.log('Direct message created successfully:', responseMessage.id);
        
        res.status(201).json(responseMessage);
    } catch (error) {
        console.error('Error creating direct message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new message (HTTP endpoint - alternative to socket)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { channelId, content, messageType = 'text', imageUrl } = req.body;
        
        console.log('Creating new message:', { channelId, content, messageType, imageUrl });

        if (!channelId || !content) {
            return res.status(400).json({ error: 'Channel ID and content are required' });
        }

        if (!ObjectId.isValid(channelId)) {
            return res.status(400).json({ error: 'Invalid channel ID' });
        }

        // Check if user has access to this channel
        const canAccess = await database.canUserAccessChannel(req.user.id, channelId);
        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied to channel' });
        }

        // Create new message in MongoDB
        const newMessage = {
            channelId: new ObjectId(channelId),
            senderId: new ObjectId(req.user.id),
            content: content,
            messageType: messageType,
            imageUrl: imageUrl || null,
            timestamp: new Date(),
            createdAt: new Date()
        };

        const result = await database.messages.insertOne(newMessage);
        
        // Get the created message with user info
        const createdMessage = await database.messages.findOne({ 
            _id: result.insertedId 
        });
        
        const user = await database.users.findOne({ 
            _id: new ObjectId(req.user.id) 
        });

        const responseMessage = {
            _id: createdMessage._id,
            id: createdMessage._id.toString(),
            channelId: createdMessage.channelId,
            senderId: createdMessage.senderId,
            content: createdMessage.content,
            messageType: createdMessage.messageType,
            imageUrl: createdMessage.imageUrl,
            timestamp: createdMessage.timestamp,
            username: user ? user.username : 'Unknown',
            userRoles: user ? user.roles : [],
            profileImage: user ? user.profileImage : null
        };

        console.log('Message created successfully:', responseMessage.id);
        
        res.status(201).json(responseMessage);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get message by ID
router.get('/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        
        if (!ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID' });
        }

        const message = await database.messages.findOne({ 
            _id: new ObjectId(messageId) 
        });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user has access to the channel this message is in
        const canAccess = await database.canUserAccessChannel(req.user.id, message.channelId.toString());
        if (!canAccess) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Add user info
        const user = await database.users.findOne({ 
            _id: new ObjectId(message.senderId) 
        });

        const responseMessage = {
            _id: message._id,
            id: message._id.toString(),
            channelId: message.channelId,
            senderId: message.senderId,
            content: message.content,
            messageType: message.messageType,
            imageUrl: message.imageUrl,
            timestamp: message.timestamp,
            username: user ? user.username : 'Unknown',
            userRoles: user ? user.roles : [],
            profileImage: user ? user.profileImage : null
        };

        res.json(responseMessage);
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update message
router.put('/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        
        if (!ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID' });
        }

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const message = await database.messages.findOne({ 
            _id: new ObjectId(messageId) 
        });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is the message sender
        if (message.senderId.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Can only edit your own messages' });
        }

        const result = await database.messages.updateOne(
            { _id: new ObjectId(messageId) },
            { 
                $set: { 
                    content: content,
                    updatedAt: new Date()
                } 
            }
        );

        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: 'Failed to update message' });
        }

        res.json({ success: true, message: 'Message updated successfully' });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete message
router.delete('/:messageId', authenticateToken, async (req, res) => {
    try {
        const { messageId } = req.params;
        
        if (!ObjectId.isValid(messageId)) {
            return res.status(400).json({ error: 'Invalid message ID' });
        }

        const message = await database.messages.findOne({ 
            _id: new ObjectId(messageId) 
        });

        if (!message) {
            return res.status(404).json({ error: 'Message not found' });
        }

        // Check if user is the message sender or has admin role
        const isSender = message.senderId.toString() === req.user.id;
        const isAdmin = req.user.roles && 
            (req.user.roles.includes('super_admin') || req.user.roles.includes('group_admin'));
        
        if (!isSender && !isAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const result = await database.messages.deleteOne({ 
            _id: new ObjectId(messageId) 
        });

        if (result.deletedCount === 0) {
            return res.status(400).json({ error: 'Failed to delete message' });
        }

        res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;