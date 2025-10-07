const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

class User {
    constructor(username, password, email, roles = ['user']) {
        this.id = uuidv4();
        this.username = username;
        this.password = password;
        this.email = email;
        this.peerId = null;
        this.roles = roles;
        this.groups = [];
        this.createdAt = new Date();
    }

    async setPassword(password) {
        this.password = await bcrypt.hash(password, 10);
    }

    async validatePassword(password) {
        return await bcrypt.compare(password, this.password);
    }

    hasRole(role) {
        return this.roles.includes(role);
    }

    isMemberOfGroup(groupId) {
        return this.groups.includes(groupId);
    }

    addToGroup(groupId) {
        if (!this.groups) this.groups = [];
        if (!this.isMemberOfGroup(groupId)) {
            this.groups.push(groupId);
        }
    }

    removeFromGroup(groupId) {
        if (this.groups) {
            const index = this.groups.indexOf(groupId);
            if (index !== -1) {
                this.groups.splice(index, 1);
            }
        }
    }
    toJSON() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            peerId: this.peerId,
            roles: this.roles,
            groups: this.groups,
            createdAt: this.createdAt
        };
    }
}

module.exports = User;