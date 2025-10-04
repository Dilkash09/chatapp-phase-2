// middleware/auth.js
const database = require("../config/database");
const { ObjectId } = require('mongodb');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        console.log('Auth Header:', authHeader);
        console.log('Token:', token);
        
        if (!token) {
            console.log('No token provided');
            return res.status(401).json({ error: 'Access token required' });
        }
        
        // Check if token is a valid MongoDB ObjectId (24-character hex string)
        if (!ObjectId.isValid(token)) {
            console.log('Invalid token format - not a valid ObjectId:', token);
            
            // Try to find user by username as fallback (for development)
            // FIXED: Use database.users instead of database.getUsersCollection()
            const userByUsername = await database.users.findOne({ 
                username: token 
            });
            
            if (userByUsername) {
                console.log('Found user by username fallback');
                req.user = {
                    id: userByUsername._id.toString(),
                    username: userByUsername.username,
                    email: userByUsername.email,
                    roles: userByUsername.roles || [],
                    groups: userByUsername.groups || [],
                    profileImage: userByUsername.profileImage,
                    isOnline: userByUsername.isOnline,
                    lastSeen: userByUsername.lastSeen
                };
                return next();
            }
            
            return res.status(403).json({ error: 'Invalid token format' });
        }
        
        // Find user by ID in MongoDB
        // FIXED: Use database.users instead of database.getUsersCollection()
        const user = await database.users.findOne({ 
            _id: new ObjectId(token) 
        });
        
        if (!user) {
            console.log('User not found for token:', token);
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        console.log('User found:', user.username);
        
        // Set user object with proper structure
        req.user = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            roles: user.roles || [], // Ensure roles is always an array
            groups: user.groups || [],
            profileImage: user.profileImage,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen
        };
        
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        
        if (error.name === 'BSONTypeError' || error.name === 'BSONError') {
            return res.status(403).json({ error: 'Invalid token format' });
        }
        
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || !req.user.roles || !req.user.roles.includes(role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// Optional: Add admin role requirement middleware
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.roles || 
        (!req.user.roles.includes('super_admin') && !req.user.roles.includes('group_admin'))) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Optional: Add super admin role requirement middleware
const requireSuperAdmin = (req, res, next) => {
    if (!req.user || !req.user.roles || !req.user.roles.includes('super_admin')) {
        return res.status(403).json({ error: 'Super admin access required' });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireRole,
    requireAdmin,
    requireSuperAdmin
};