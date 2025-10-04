module.exports = {
    ROLES: {
        SUPER_ADMIN: 'super_admin',
        GROUP_ADMIN: 'group_admin',
        USER: 'user'
    },
    
    ERROR_MESSAGES: {
        UNAUTHORIZED: 'Unauthorized access',
        FORBIDDEN: 'Insufficient permissions',
        NOT_FOUND: 'Resource not found',
        VALIDATION_ERROR: 'Validation error',
        INTERNAL_ERROR: 'Internal server error'
    },
    
    SUCCESS_MESSAGES: {
        USER_CREATED: 'User created successfully',
        USER_UPDATED: 'User updated successfully',
        USER_DELETED: 'User deleted successfully',
        GROUP_CREATED: 'Group created successfully',
        CHANNEL_CREATED: 'Channel created successfully',
        MESSAGE_SENT: 'Message sent successfully'
    }
};