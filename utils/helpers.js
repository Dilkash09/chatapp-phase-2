const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

const formatDate = (date) => {
    return new Date(date).toLocaleString();
};

const hasAccessToGroup = (user, groupId) => {
    return user.roles.includes('super_admin') || 
           user.groups.includes(groupId) || 
           groups.find(g => g.id === groupId)?.createdBy === user.id;
};

const hasAccessToChannel = (user, channelId) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return false;
    
    const group = groups.find(g => g.id === channel.groupId);
    if (!group) return false;
    
    return hasAccessToGroup(user, group.id);
};

module.exports = {
    generateId,
    formatDate,
    hasAccessToGroup,
    hasAccessToChannel
};