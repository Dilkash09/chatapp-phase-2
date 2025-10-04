const { v4: uuidv4 } = require('uuid');

class Group {
    constructor(name, createdBy, description = '') {
        this.id = uuidv4();
        this.name = name;
        this.description = description;
        this.createdBy = createdBy;
        this.members = [createdBy];
        this.createdAt = new Date();
    }

    addMember(userId) {
        if (!this.members.includes(userId)) {
            this.members.push(userId);
        }
    }

    removeMember(userId) {
        this.members = this.members.filter(id => id !== userId);
    }

    isMember(userId) {
        return this.members.includes(userId);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            createdBy: this.createdBy,
            members: this.members,
            createdAt: this.createdAt
        };
    }
}

module.exports = Group;