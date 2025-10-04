const { v4: uuidv4 } = require('uuid');

class Channel {
    constructor(name, groupId, createdBy) {
        this.id = uuidv4();
        this.name = name;
        this.groupId = groupId;
        this.createdBy = createdBy;
        this.createdAt = new Date();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            groupId: this.groupId,
            createdBy: this.createdBy,
            createdAt: this.createdAt
        };
    }
}

module.exports = Channel;