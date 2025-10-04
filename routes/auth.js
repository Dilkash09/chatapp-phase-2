const express = require('express');
const router = express.Router();
const database = require('../config/database');
const { ObjectId } = require('mongodb');

// Simple login route
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('Login attempt for username:', username);
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // FIXED: Use database.users instead of database.getUsersCollection()
        const user = await database.users.findOne({ 
            username: username 
        });
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        console.log('User found, checking password...');
        
        // Simple password check (in production, use bcrypt)
        if (user.password !== password) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update user's online status - FIXED: Use database.users
        await database.users.updateOne(
            { _id: user._id },
            { 
                $set: { 
                    isOnline: true,
                    lastSeen: new Date(),
                    updatedAt: new Date()
                } 
            }
        );
        
        console.log('Login successful for user:', username);
        
        // Return user data
        res.json({
            token: user._id.toString(), // Using user ID as token
            user: {
                id: user._id.toString(),
                primaryId: user._id.toString(), // Add primaryId for compatibility
                username: user.username,
                email: user.email,
                roles: user.roles,
                profileImage: user.profileImage,
                isOnline: true,
                groups: user.groups || [],
                peerId: user.peerId || null
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Debug endpoint to get all users (remove in production)
router.get('/debug-users', async (req, res) => {
    try {
        // FIXED: Use database.users
        const users = await database.users.find().toArray();
        const safeUsers = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            roles: user.roles,
            hasPassword: !!user.password,
            profileImage: user.profileImage || 'No profile image'
        }));
        res.json(safeUsers);
    } catch (error) {
        console.error('Debug users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Test authentication endpoint
router.get('/test-auth', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        res.json({
            hasAuthHeader: !!authHeader,
            token: token,
            isValidObjectId: token ? ObjectId.isValid(token) : false,
            message: 'This endpoint helps debug authentication issues'
        });
    } catch (error) {
        console.error('Test auth error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout route
router.post('/logout', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (token && ObjectId.isValid(token)) {
            // Update user's online status - FIXED: Use database.users
            await database.users.updateOne(
                { _id: new ObjectId(token) },
                { 
                    $set: { 
                        isOnline: false,
                        lastSeen: new Date(),
                        updatedAt: new Date()
                    } 
                }
            );
            console.log('User logged out:', token);
        }
        
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        console.log('GET /me - Token:', token);
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        
        let user;
        
        if (ObjectId.isValid(token)) {
            // Token is a valid ObjectId - find by ID
            user = await database.users.findOne({ 
                _id: new ObjectId(token) 
            });
        } else {
            // Token might be a username - find by username
            user = await database.users.findOne({ 
                username: token 
            });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user._id.toString(),
            primaryId: user._id.toString(), // Add primaryId for compatibility
            username: user.username,
            email: user.email,
            roles: user.roles,
            profileImage: user.profileImage,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
            groups: user.groups || [],
            peerId: user.peerId || null,
            token: token // Include token for compatibility
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        console.log('Registration attempt for username:', username);
        
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email and password required' });
        }
        
        // Check if user already exists
        const existingUser = await database.users.findOne({
            $or: [
                { username: username },
                { email: email }
            ]
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        // Create new user
        const newUser = {
            username: username,
            email: email,
            password: password, // In production, hash this!
            roles: ['user'],
            groups: [],
            profileImage: null,
            peerId: null,
            isOnline: false,
            lastSeen: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await database.users.insertOne(newUser);
        
        console.log('New user registered:', username);
        
        res.json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: result.insertedId.toString(),
                primaryId: result.insertedId.toString(),
                username: username,
                email: email,
                roles: ['user'],
                profileImage: null,
                isOnline: false
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;