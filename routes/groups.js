const express = require('express');
const router = express.Router();
const database = require('../config/database'); // Import the database instance
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateGroup, validateChannel } = require('../middleware/validation');
const { ROLES } = require('../utils/constants');
const { hasAccessToGroup } = require('../utils/helpers');
const { ObjectId } = require('mongodb');

// Get user's groups
router.get('/my-groups', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id; // Assuming req.user.id contains the user's ObjectId
        
        let userGroups;
        
        if (req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            // Super admin can see all groups - FIXED: Use database.groups
            userGroups = await database.groups.find().toArray();
        } else {
            // Regular users see only groups they're members of - FIXED: Use database.groups
            userGroups = await database.groups.find({
                $or: [
                    { members: new ObjectId(userId) },
                    { createdBy: new ObjectId(userId) }
                ]
            }).toArray();
        }
        
        res.json(userGroups);
    } catch (error) {
        console.error('Error fetching user groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all groups (for super admin)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (!req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // FIXED: Use database.groups
        const allGroups = await database.groups.find().toArray();
        res.json(allGroups);
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new group
router.post('/', authenticateToken, validateGroup, async (req, res) => {
    try {
        if (!req.user.roles.includes(ROLES.SUPER_ADMIN) && !req.user.roles.includes(ROLES.GROUP_ADMIN)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const { name, description } = req.body;
        const userId = new ObjectId(req.user.id);
        
        const newGroup = {
            name,
            description,
            createdBy: userId,
            admins: [userId],
            members: [userId],
            channels: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // FIXED: Use database.groups
        const result = await database.groups.insertOne(newGroup);
        
        // Add group to user's groups array - FIXED: Use database.users
        await database.users.updateOne(
            { _id: userId },
            { 
                $push: { groups: result.insertedId },
                $set: { updatedAt: new Date() }
            }
        );
        
        res.status(201).json({
            _id: result.insertedId,
            ...newGroup
        });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get a specific group
router.get('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        
        // Validate groupId format
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if user has access to this group
        const hasAccess = group.members.some(member => 
            member.toString() === req.user.id.toString()
        ) || group.createdBy.toString() === req.user.id.toString();
        
        if (!hasAccess && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(group);
    } catch (error) {
        console.error('Error fetching group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update an existing group
router.put('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description } = req.body;
        
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check for permissions
        const isCreator = group.createdBy.toString() === req.user.id.toString();
        const isSuperAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN);
        
        if (!isCreator && !isSuperAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        const updateFields = { updatedAt: new Date() };
        if (name) updateFields.name = name;
        if (description) updateFields.description = description;
        
        // FIXED: Use database.groups
        const result = await database.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { $set: updateFields }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: 'Failed to update group' });
        }
        
        // FIXED: Use database.groups
        const updatedGroup = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        res.json(updatedGroup);
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create a new channel within a group
router.post('/:groupId/channels', authenticateToken, validateChannel, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { name, description } = req.body;
        
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if the user has permission to create a channel in this group
        const isCreator = group.createdBy.toString() === req.user.id.toString();
        const isSuperAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN);
        const isGroupAdmin = group.admins.some(admin => 
            admin.toString() === req.user.id.toString()
        );
        
        if (!isCreator && !isSuperAdmin && !isGroupAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Check if channel already exists with same name in this group - FIXED: Use database.channels
        const existingChannel = await database.channels.findOne({
            groupId: new ObjectId(groupId),
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        
        if (existingChannel) {
            return res.status(400).json({ error: 'Channel already exists in this group' });
        }
        
        // Create new channel - FIXED: Use database.channels
        const newChannel = {
            name,
            description: description || '',
            groupId: new ObjectId(groupId),
            createdBy: new ObjectId(req.user.id),
            bannedUsers: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // FIXED: Use database.channels
        const result = await database.channels.insertOne(newChannel);
        
        // Add channel to group's channels array - FIXED: Use database.groups
        await database.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { 
                $push: { channels: result.insertedId },
                $set: { updatedAt: new Date() }
            }
        );
        
        res.status(201).json({
            _id: result.insertedId,
            ...newChannel
        });
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get channels for a specific group
router.get('/:groupId/channels', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if user has access to this group
        const hasAccess = group.members.some(member => 
            member.toString() === req.user.id.toString()
        ) || group.createdBy.toString() === req.user.id.toString();
        
        if (!hasAccess && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // FIXED: Use database.channels
        const groupChannels = await database.channels.find({
            groupId: new ObjectId(groupId)
        }).toArray();
        
        res.json(groupChannels);
    } catch (error) {
        console.error('Error fetching group channels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a group
router.delete('/:groupId', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check permissions
        const isCreator = group.createdBy.toString() === req.user.id.toString();
        const isSuperAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN);
        
        if (!isCreator && !isSuperAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Delete the group - FIXED: Use database.groups
        await database.groups.deleteOne({ 
            _id: new ObjectId(groupId) 
        });
        
        // Remove group from all users' groups arrays - FIXED: Use database.users
        await database.users.updateMany(
            { groups: new ObjectId(groupId) },
            { $pull: { groups: new ObjectId(groupId) } }
        );
        
        // Delete all channels in this group - FIXED: Use database.channels
        await database.channels.deleteMany({
            groupId: new ObjectId(groupId)
        });
        
        // Delete all messages in channels of this group - FIXED: Use database.messages
        const groupChannels = await database.channels.find({
            groupId: new ObjectId(groupId)
        }).toArray();
        
        const channelIds = groupChannels.map(channel => channel._id);
        if (channelIds.length > 0) {
            await database.messages.deleteMany({
                channelId: { $in: channelIds }
            });
        }
        
        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add user to group
router.post('/:groupId/members', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { userId } = req.body;
        
        if (!ObjectId.isValid(groupId) || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check permissions - only group creator/admins or super admin can add members
        const isCreator = group.createdBy.toString() === req.user.id.toString();
        const isSuperAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN);
        const isGroupAdmin = group.admins.some(admin => 
            admin.toString() === req.user.id.toString()
        );
        
        if (!isCreator && !isSuperAdmin && !isGroupAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Find the user to add - FIXED: Use database.users
        const userToAdd = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!userToAdd) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user is already a member
        const isAlreadyMember = group.members.some(member => 
            member.toString() === userId
        );
        
        if (isAlreadyMember) {
            return res.status(400).json({ error: 'User is already a member of this group' });
        }
        
        // Add user to group members - FIXED: Use database.groups
        await database.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { 
                $push: { members: new ObjectId(userId) },
                $set: { updatedAt: new Date() }
            }
        );
        
        // Add group to user's groups array - FIXED: Use database.users
        await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $push: { groups: new ObjectId(groupId) },
                $set: { updatedAt: new Date() }
            }
        );
        
        res.json({ 
            message: 'User added to group successfully'
        });
    } catch (error) {
        console.error('Error adding user to group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove user from group
router.delete('/:groupId/members/:userId', authenticateToken, async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        
        if (!ObjectId.isValid(groupId) || !ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid ID format' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check permissions
        const isCreator = group.createdBy.toString() === req.user.id.toString();
        const isSuperAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN);
        const isGroupAdmin = group.admins.some(admin => 
            admin.toString() === req.user.id.toString()
        );
        
        if (!isCreator && !isSuperAdmin && !isGroupAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        // Check if user is a member
        const isMember = group.members.some(member => 
            member.toString() === userId
        );
        
        if (!isMember) {
            return res.status(400).json({ error: 'User is not a member of this group' });
        }
        
        // Remove user from group members - FIXED: Use database.groups
        await database.groups.updateOne(
            { _id: new ObjectId(groupId) },
            { 
                $pull: { 
                    members: new ObjectId(userId),
                    admins: new ObjectId(userId) // Also remove from admins if they were an admin
                },
                $set: { updatedAt: new Date() }
            }
        );
        
        // Remove group from user's groups array - FIXED: Use database.users
        await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $pull: { groups: new ObjectId(groupId) },
                $set: { updatedAt: new Date() }
            }
        );
        
        res.json({ 
            message: 'User removed from group successfully'
        });
    } catch (error) {
        console.error('Error removing user from group:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get group members
router.get('/:groupId/members', authenticateToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        
        if (!ObjectId.isValid(groupId)) {
            return res.status(400).json({ error: 'Invalid group ID' });
        }
        
        // FIXED: Use database.groups
        const group = await database.groups.findOne({ 
            _id: new ObjectId(groupId) 
        });
        
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        
        // Check if user has access to this group
        const hasAccess = group.members.some(member => 
            member.toString() === req.user.id.toString()
        ) || group.createdBy.toString() === req.user.id.toString();
        
        if (!hasAccess && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get detailed member information - FIXED: Use database.users
        const memberIds = group.members.map(member => new ObjectId(member));
        const groupMembers = await database.users.find({
            _id: { $in: memberIds }
        }).project({
            password: 0 // Exclude password field
        }).toArray();
        
        res.json(groupMembers);
    } catch (error) {
        console.error('Error fetching group members:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;