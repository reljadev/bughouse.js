const { initalizeServer } = require('./server/server');
const { clientIO } = require('./server/clientIO');
const { gameCoordinator } = require('./server/gameCoordinator');

// set up server
initalizeServer();

// when game coordinator creates a new game, 
// clientIO needs to create a communication for that game
gameCoordinator.setCallbackUponCreatingGame(
    clientIO.createGameCommunicationChannel.bind(clientIO)
);