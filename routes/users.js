const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const { ObjectId } = require('mongodb');

// Get all users (admin only)
router.get('/', authenticateToken, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
        console.log('=== GET /api/users - START ===');
        
        // Log the requesting user
        console.log('Requesting user:', {
            id: req.user.id,
            username: req.user.username,
            roles: req.user.roles
        });
        
        // Get users from database - FIXED: Use database.users
        console.log('Fetching users from database...');
        const users = await database.users.find().toArray();
        console.log(`Found ${users.length} users in database`);
        
        // Log each user with their data
        console.log('=== ALL USERS FROM DATABASE ===');
        users.forEach((user, index) => {
            console.log(`User ${index + 1}:`, {
                _id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                groups: user.groups,
                hasPassword: !!user.password,
                profileImage: user.profileImage,
                peerId: user.peerId,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            });
        });
        console.log('=== END USERS LIST ===');
        
        // Remove passwords from response
        console.log('Removing passwords from response...');
        const usersWithoutPasswords = users.map(user => {
            const userWithoutPassword = {
                _id: user._id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                groups: user.groups,
                profileImage: user.profileImage,
                peerId: user.peerId,
                isOnline: user.isOnline,
                lastSeen: user.lastSeen,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            };
            console.log(`Processed user: ${user.username}`, userWithoutPassword);
            return userWithoutPassword;
        });
        
        console.log('=== GET /api/users - SUCCESS ===');
        console.log(`Returning ${usersWithoutPasswords.length} users without passwords`);
        
        res.json(usersWithoutPasswords);
    } catch (error) {
        console.error('=== GET /api/users - ERROR ===');
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(req.user.id) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Return user without password
        const userWithoutPassword = {
            _id: user._id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            groups: user.groups,
            profileImage: user.profileImage,
            peerId: user.peerId,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by ID
router.get('/:userId', authenticateToken, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Return user without password
        const userWithoutPassword = {
            _id: user._id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            groups: user.groups,
            profileImage: user.profileImage,
            peerId: user.peerId,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
        
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Promote user to group admin
router.post('/:userId/promote', authenticateToken, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user is already a group admin
        if (user.roles && user.roles.includes(ROLES.GROUP_ADMIN)) {
            return res.status(400).json({ error: 'User is already a group admin' });
        }
        
        // Add GROUP_ADMIN role
        const updatedRoles = [...(user.roles || []), ROLES.GROUP_ADMIN];
        
        // FIXED: Use database.users
        await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    roles: updatedRoles,
                    updatedAt: new Date()
                } 
            }
        );
        
        res.json({ 
            message: 'User promoted to group admin successfully',
            userId: userId,
            newRoles: updatedRoles
        });
    } catch (error) {
        console.error('Error promoting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Promote user to Super Admin
router.post('/:userId/promote-super', authenticateToken, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if user is already a super admin
        if (user.roles && user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(400).json({ error: 'User is already a super admin' });
        }
        
        // Add SUPER_ADMIN role
        const updatedRoles = [...(user.roles || []), ROLES.SUPER_ADMIN];
        
        // FIXED: Use database.users
        await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    roles: updatedRoles,
                    updatedAt: new Date()
                } 
            }
        );
        
        res.json({ 
            message: 'User promoted to super admin successfully',
            userId: userId,
            newRoles: updatedRoles
        });
    } catch (error) {
        console.error('Error promoting user to super admin:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Demote user (remove admin roles)
router.post('/:userId/demote', authenticateToken, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // Prevent demoting yourself
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot demote yourself' });
        }
        
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove admin roles but keep basic user role
        const updatedRoles = (user.roles || []).filter(role => 
            role !== ROLES.GROUP_ADMIN && role !== ROLES.SUPER_ADMIN
        );
        
        // Ensure user has at least basic user role
        if (updatedRoles.length === 0) {
            updatedRoles.push('user'); // Basic user role
        }
        
        // FIXED: Use database.users
        await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    roles: updatedRoles,
                    updatedAt: new Date()
                } 
            }
        );
        
        res.json({ 
            message: 'User demoted successfully',
            userId: userId,
            newRoles: updatedRoles
        });
    } catch (error) {
        console.error('Error demoting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile
router.put('/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, email, profileImage } = req.body;
        
        // Users can only update their own profile unless they're super admin
        if (userId !== req.user.id && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Can only update your own profile' });
        }
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        const updateFields = { updatedAt: new Date() };
        if (username) updateFields.username = username;
        if (email) updateFields.email = email;
        if (profileImage !== undefined) updateFields.profileImage = profileImage;
        
        // FIXED: Use database.users
        const result = await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: updateFields }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: 'Failed to update user' });
        }
        
        // FIXED: Use database.users
        const updatedUser = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        // Return user without password
        const userWithoutPassword = {
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            roles: updatedUser.roles,
            groups: updatedUser.groups,
            profileImage: updatedUser.profileImage,
            peerId: updatedUser.peerId,
            isOnline: updatedUser.isOnline,
            lastSeen: updatedUser.lastSeen,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        };
        
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user
router.delete('/:userId', authenticateToken, requireRole(ROLES.SUPER_ADMIN), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // Prevent deleting yourself
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }
        
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove user from all groups
        if (user.groups && user.groups.length > 0) {
            for (const groupId of user.groups) {
                // FIXED: Use database.groups
                await database.groups.updateOne(
                    { _id: new ObjectId(groupId) },
                    { 
                        $pull: { 
                            members: new ObjectId(userId),
                            admins: new ObjectId(userId)
                        },
                        $set: { updatedAt: new Date() }
                    }
                );
            }
        }
        
        // Delete the user - FIXED: Use database.users
        await database.users.deleteOne({ 
            _id: new ObjectId(userId) 
        });
        
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user's groups
router.get('/:userId/groups', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Users can only see their own groups unless they're super admin
        if (userId !== req.user.id && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Can only view your own groups' });
        }
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        // FIXED: Use database.users
        const user = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's groups - FIXED: Use database.groups
        const userGroups = await database.groups.find({
            _id: { $in: user.groups || [] }
        }).toArray();
        
        res.json(userGroups);
    } catch (error) {
        console.error('Error fetching user groups:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user profile image
router.put('/:userId/profile-image', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { profileImage } = req.body;
        
        // Users can only update their own profile unless they're super admin
        if (userId !== req.user.id && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Can only update your own profile' });
        }
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        if (!profileImage) {
            return res.status(400).json({ error: 'Profile image URL is required' });
        }
        
        // FIXED: Use database.users
        const result = await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    profileImage: profileImage,
                    updatedAt: new Date()
                } 
            }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: 'Failed to update profile image' });
        }
        
        res.json({ 
            success: true, 
            message: 'Profile image updated successfully',
            profileImage: profileImage
        });
    } catch (error) {
        console.error('Error updating profile image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// In routes/users.js - add this route
// Update user profile image
router.put('/:userId/profile-image', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { profileImage } = req.body;
        
        // Users can only update their own profile unless they're super admin
        if (userId !== req.user.id && !req.user.roles.includes(ROLES.SUPER_ADMIN)) {
            return res.status(403).json({ error: 'Can only update your own profile' });
        }
        
        if (!ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid user ID' });
        }
        
        if (!profileImage) {
            return res.status(400).json({ error: 'Profile image URL is required' });
        }
        
        // Update user profile image
        const result = await database.users.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $set: { 
                    profileImage: profileImage,
                    updatedAt: new Date()
                } 
            }
        );
        
        if (result.modifiedCount === 0) {
            return res.status(400).json({ error: 'Failed to update profile image' });
        }
        
        // Get updated user
        const updatedUser = await database.users.findOne({ 
            _id: new ObjectId(userId) 
        });
        
        // Return user without password
        const userWithoutPassword = {
            _id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            roles: updatedUser.roles,
            groups: updatedUser.groups,
            profileImage: updatedUser.profileImage,
            peerId: updatedUser.peerId,
            isOnline: updatedUser.isOnline,
            lastSeen: updatedUser.lastSeen,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt
        };
        
        res.json({ 
            success: true, 
            message: 'Profile image updated successfully',
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('Error updating profile image:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;