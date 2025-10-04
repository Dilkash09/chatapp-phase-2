const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { ObjectId } = require('mongodb');
const database = require('../config/database');

const router = express.Router();

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const messagesDir = path.join(uploadsDir, 'messages');

[uploadsDir, profilesDir, messagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for different upload types
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, profilesDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'profile-' + uniqueSuffix + ext);
    }
});

const messageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, messagesDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'message-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'), false);
    }
};

const uploadProfile = multer({
    storage: profileStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const uploadMessage = multer({
    storage: messageStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Helper function to get image dimensions
// Helper function to get image dimensions
// Simple helper that returns default dimensions
const getImageDimensions = (filePath) => {
    return new Promise((resolve) => {
        // For now, return default dimensions
        // You can implement proper dimension extraction later
        resolve({ width: 800, height: 600 });
    });
};

// Upload profile image - matches Angular service endpoint
router.post('/profile', authenticateToken, uploadProfile.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }

        const { userId } = req.body;
        
        if (!userId) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false, 
                error: 'User ID is required' 
            });
        }

        // Verify user exists and has permission
        const user = await database.findUser({ _id: new ObjectId(userId) });
        if (!user) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Get image dimensions
        const dimensions = await getImageDimensions(req.file.path);

        // Construct file URL
        const filePath = `/uploads/profiles/${req.file.filename}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${filePath}`;

        // Update user profile in database
        await database.updateUser(userId, {
            profileImage: filePath,
            updatedAt: new Date()
        });

        console.log(`Profile image uploaded for user ${userId}: ${filePath}`);

        res.json({ 
            success: true, 
            filePath: filePath,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            dimensions: dimensions,
            message: 'Profile image uploaded successfully'
        });

    } catch (error) {
        console.error('Error uploading profile image:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload profile image' 
        });
    }
});

// Upload message image - matches Angular service endpoint
router.post('/message', authenticateToken, uploadMessage.single('messageImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }

        const { channelId, userId } = req.body;
        
        if (!channelId || !userId) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false, 
                error: 'Channel ID and User ID are required' 
            });
        }

        // Verify user exists and has access to channel
        const user = await database.findUser({ _id: new ObjectId(userId) });
        if (!user) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ 
                success: false, 
                error: 'User not found' 
            });
        }

        // Check if user can access the channel
        const canAccess = await database.canUserAccessChannel(userId, channelId);
        if (!canAccess) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied to channel' 
            });
        }

        // Get image dimensions
        const dimensions = await getImageDimensions(req.file.path);

        // Construct file URL
        const filePath = `/uploads/messages/${req.file.filename}`;
        const fullUrl = `${req.protocol}://${req.get('host')}${filePath}`;

        console.log(`Message image uploaded by user ${userId} for channel ${channelId}: ${filePath}`);

        res.json({ 
            success: true, 
            filePath: filePath,
            fileName: req.file.originalname,
            fileSize: req.file.size,
            dimensions: dimensions,
            message: 'Message image uploaded successfully'
        });

    } catch (error) {
        console.error('Error uploading message image:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            error: 'Failed to upload message image' 
        });
    }
});

// Upload with progress (optional endpoint)
router.post('/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params; // 'profile' or 'message'
        
        let uploadMiddleware;
        if (type === 'profile') {
            uploadMiddleware = uploadProfile.single('profileImage');
        } else if (type === 'message') {
            uploadMiddleware = uploadMessage.single('messageImage');
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid upload type. Use "profile" or "message"' 
            });
        }

        uploadMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ 
                    success: false, 
                    error: err.message 
                });
            }

            if (!req.file) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'No file uploaded' 
                });
            }

            try {
                const { userId, channelId } = req.body;
                const dimensions = await getImageDimensions(req.file.path);

                let filePath;
                if (type === 'profile') {
                    filePath = `/uploads/profiles/${req.file.filename}`;
                    
                    // Update user profile
                    if (userId) {
                        await database.updateUser(userId, {
                            profileImage: filePath,
                            updatedAt: new Date()
                        });
                    }
                } else {
                    filePath = `/uploads/messages/${req.file.filename}`;
                    
                    // Verify channel access for message images
                    if (channelId && userId) {
                        const canAccess = await database.canUserAccessChannel(userId, channelId);
                        if (!canAccess) {
                            fs.unlinkSync(req.file.path);
                            return res.status(403).json({ 
                                success: false, 
                                error: 'Access denied to channel' 
                            });
                        }
                    }
                }

                res.json({ 
                    success: true, 
                    filePath: filePath,
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    dimensions: dimensions,
                    message: `${type} image uploaded successfully`
                });

            } catch (error) {
                console.error(`Error uploading ${type} image:`, error);
                
                // Clean up file on error
                if (req.file && fs.existsSync(req.file.path)) {
                    fs.unlinkSync(req.file.path);
                }
                
                res.status(500).json({ 
                    success: false, 
                    error: `Failed to upload ${type} image` 
                });
            }
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Upload failed' 
        });
    }
});

// Get uploaded file
router.get('/files/:type/:filename', (req, res) => {
    try {
        const { type, filename } = req.params;
        
        let filePath;
        if (type === 'profiles') {
            filePath = path.join(profilesDir, filename);
        } else if (type === 'messages') {
            filePath = path.join(messagesDir, filename);
        } else {
            return res.status(400).json({ error: 'Invalid file type' });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).json({ error: 'Failed to serve file' });
    }
});

// Delete uploaded file
router.delete('/files/:type/:filename', authenticateToken, async (req, res) => {
    try {
        const { type, filename } = req.params;
        
        let filePath;
        if (type === 'profiles') {
            filePath = path.join(profilesDir, filename);
        } else if (type === 'messages') {
            filePath = path.join(messagesDir, filename);
        } else {
            return res.status(400).json({ error: 'Invalid file type' });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Delete file
        fs.unlinkSync(filePath);

        // If it's a profile image, update user record
        if (type === 'profiles') {
            await database.updateUser(req.user.id, {
                profileImage: null,
                updatedAt: new Date()
            });
        }

        res.json({ 
            success: true, 
            message: 'File deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                success: false,
                error: 'File too large. Maximum size is 5MB' 
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ 
                success: false,
                error: 'Unexpected file field' 
            });
        }
    }
    
    console.error('Upload error:', error);
    res.status(500).json({ 
        success: false,
        error: error.message 
    });
});

module.exports = router;