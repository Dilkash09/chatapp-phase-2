const express = require('express');
const router = express.Router();
const { users, groups } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateGroup } = require('../middleware/validation');
const { ROLES } = require('../utils/constants');
const { hasAccessToGroup } = require('../utils/helpers');
const { hasAccessToGroup, hasAccessToChannel } = require('../utils/helpers');

// Get all groups
router.get('/', authenticateToken, (req, res) => {
    let userGroups;
    
    if (req.user.hasRole(ROLES.SUPER_ADMIN)) {
        // Super admin can see all groups
        userGroups = groups;
    } else {
        // Regular users can only see groups they're members of or administer
        userGroups = groups.filter(group => 
            req.user.isMemberOfGroup(group.id) || 
            group.createdBy === req.user.id
        );
    }
    
    res.json(userGroups.map(group => group.toJSON()));
});

// Create a new group
router.post('/', authenticateToken, validateGroup, (req, res) => {
    if (!req.user.hasRole(ROLES.SUPER_ADMIN) && !req.user.hasRole(ROLES.GROUP_ADMIN)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { name, description } = req.body;
    
    const newGroup = new Group(name, req.user.id, description);
    groups.push(newGroup);
    
    // Add group to user's groups
    req.user.addToGroup(newGroup.id);
    
    res.status(201).json(newGroup.toJSON());
});

// Get a specific group
router.get('/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!hasAccessToGroup(req.user, groupId)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(group.toJSON());
});

// Delete a group
router.delete('/:groupId', authenticateToken, (req, res) => {
    const { groupId } = req.params;
    const group = groups.find(g => g.id === groupId);
    
    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }
    
    if (group.createdBy !== req.user.id && !req.user.hasRole(ROLES.SUPER_ADMIN)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const groupIndex = groups.findIndex(g => g.id === groupId);
    groups.splice(groupIndex, 1);
    
    res.json({ message: 'Group deleted successfully' });
});



// Get messages for a specific channel
router.get('/:channelId/messages', authenticateToken, (req, res) => {
    const { channelId } = req.params;
    if (!hasAccessToChannel(req.user, channelId)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const channelMessages = messages.filter(m => m.channelId === channelId);
    res.json(channelMessages);
});
module.exports = router;