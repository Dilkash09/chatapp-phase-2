const { v4: uuidv4 } = require('uuid');

class Message {
    constructor(text, userId, channelId) {
        this.id = uuidv4();
        this.text = text;
        this.userId = userId;
        this.channelId = channelId;
        this.timestamp = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            text: this.text,
            userId: this.userId,
            channelId: this.channelId,
            timestamp: this.timestamp
        };
    }
}

module.exports = Message;