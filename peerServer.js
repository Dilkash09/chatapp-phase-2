const { ExpressPeerServer } = require('peer');

function setupPeerServer(server) {
  const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    debug: true,
    allow_discovery: true,
    proxied: true
  });

  peerServer.on('connection', (client) => {
    console.log('Peer connected:', client.getId());
  });

  peerServer.on('disconnect', (client) => {
    console.log('Peer disconnected:', client.getId());
  });

  peerServer.on('error', (error) => {
    console.error('Peer server error:', error);
  });

  return peerServer;
}

module.exports = { setupPeerServer };