const validateRegistration = (req, res, next) => {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    next();
};

const validateLogin = (req, res, next) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    
    next();
};

const validateGroup = (req, res, next) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Group name is required' });
    }
    
    if (name.length < 3) {
        return res.status(400).json({ error: 'Group name must be at least 3 characters' });
    }
    
    next();
};

// In validation.js
const validateChannel = (req, res, next) => {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: 'Channel name is required' });
    }
    
    if (name.trim().length < 2) {
        return res.status(400).json({ error: 'Channel name must be at least 2 characters long' });
    }
    
    if (name.trim().length > 50) {
        return res.status(400).json({ error: 'Channel name cannot exceed 50 characters' });
    }
    
    next();
};

module.exports = {
    validateRegistration,
    validateLogin,
    validateGroup,
    validateChannel
};