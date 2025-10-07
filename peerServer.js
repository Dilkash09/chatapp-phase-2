const express = require('express');
const { ExpressPeerServer } = require('peer');

const app = express();

const server = app.listen(3001, () => {
  console.log('Server running on port 3001');
});

// Create PeerJS server
const peerServer = ExpressPeerServer(server, {
  path: '/peerjs',
  allow_discovery: true
});

app.use('/peerjs', peerServer);

console.log('PeerJS server running on port 3001');