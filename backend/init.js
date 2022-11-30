const { initalizeServer } = require('./server/server');
const { initializeClientIO } = require('./server/clientIO');

// set up server
const server = initalizeServer();

// set up SOCKET communication
initializeClientIO(server);