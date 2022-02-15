// server.js - handles our server code

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 3000;

// define our players, milkshake and score
var players = {};
var milkshake = {
    x: Math.random(),
    y: Math.random(),
}
var scores = {}

// define matches array to hold string references for all our rooms plus player numbers in each
const matches = [];
const ROOM_CAPACITY = 2;
const WIN_CONDITION = 5;

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', socket => {
    console.log('User: ' + socket.id +' connected');

    // after a player is connected we wait for them to hit the findMatch button
    socket.on('findMatch', () => {
        console.log('Locating match for socket ID: ' + socket.id);

        let startMatch = false;

        // store the data for the new player
        players[socket.id] = {
            rotation: 0,
            x: Math.random(),
            y: Math.random(),
            playerId: socket.id,
            team: (Math.floor(Math.random() * 2) == 0) ? 'rasta' : 'viking',
        };
       
        // if no matches or current match room is full we need to add another match
        if (matches.length === 0) {
            // make another "room"
            matches.push({
                name: 'Match' + (matches.length+1).toString(),
                players: 1,
            });
        } else if (matches[matches.length-1].players >= ROOM_CAPACITY) {
            // make another "room"
            matches.push({
                name: 'Match' + (matches.length+1).toString(),
                players: 1,
            });
        } else {
            // there's space so we can join the current room and increment number of players
            matches[matches.length-1].players++;

            // if we get to capacity start the match
            if (matches[matches.length-1].players === ROOM_CAPACITY) {
                console.log('Starting match: ' + matches[matches.length-1].name);
                startMatch = true;
            }
        }

        // join latest match
        socket.join(matches[matches.length-1].name);

        // set our room name for the socket
        players[socket.id].match = matches[matches.length-1].name;

        // assign odd number players to rasta and even to viking
        if (matches[matches.length-1].players % 2 === 1) players[socket.id].team = 'rasta';
        else players[socket.id].team = 'viking';

        // output results of match making
        console.log('Socked id: ' + socket.id + ' joined match: ' + matches[matches.length-1].name);
        console.log(matches[matches.length-1].name + ' now has ' + matches[matches.length-1].players + ' players')
        console.log('Number of matches ongoing: ' + matches.length);

        // send the client all the players to be added to their instance of the game
        socket.emit('currentPlayers', players);

        // update all players in the room about the new player
        io.to(players[socket.id].match).emit('newPlayer', players[socket.id]);

        if (startMatch) {
            // tell each player in this room to start their match,
            io.to(players[socket.id].match).emit('startMatch');

            // initialise scores
            scores[players[socket.id].match] = { rasta: 0, viking: 0}

            // emit functions for sending milkshake location and scores to clients
            io.to(players[socket.id].match).emit('milkshakeUpdate', milkshake);
            io.to(players[socket.id].match).emit('scoreUpdate', scores[players[socket.id].match]);
        }
    })

    // handle disconnection
    socket.on('disconnect', function () {
        console.log('User: ' + socket.id + ' disconnected');

        if (players[socket.id]) {

            // find what match this socket was in
            for (let i = 0; i < matches.length; i++) {
                if (matches[i].name === players[socket.id].match) {
                    // reduce number of players in the match
                    matches[i].players--;

                    // players is now 0 we need to splice out the match
                    if (matches[i].players === 0) {
                        console.log('Due to player disconnection, removing Match: ' + matches[i].name);
                        matches.splice(i,1);
                    }
                }
            }

            // leave the room this socket is in
            if (players[socket.id]) socket.leave(players[socket.id].match);

            // remove player from players
            delete players[socket.id];

            // tell all players to remove this player
            socket.broadcast.emit('removePlayer', socket.id);
        }
    });

    // when a player moves, update the player data
    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].rotation = movementData.rotation;
            
            // emit a message to all players about the player that moved
            io.to(players[socket.id].match).emit('playerMoved', players[socket.id]);
        }
    });

    // listen for milkshake slurpage
    socket.on('milkshakeSlurped', () => {
        console.log(players[socket.id].team + ' gotchi id: ' + socket.id + ' slurped milkshake');

        // score points for the team the player is on
        if (players[socket.id].team === 'rasta') {
            scores[players[socket.id].match].rasta += 1;
        } else {
            scores[players[socket.id].match].viking += 1;
        }

        // broad cast scores
        io.to(players[socket.id].match).emit('scoreUpdate', scores[players[socket.id].match]);

        // check for victory event
        if (scores[players[socket.id].match].rasta === WIN_CONDITION || scores[players[socket.id].match].viking === WIN_CONDITION) {
            // send an end match note to all room clients with the winning player as a parameter
            io.to(players[socket.id].match).emit('endMatch', players[socket.id]);

            // store the name of the match that ended
            const endedMatchName = players[socket.id].match;
            
            // remove the match from our array
            for (let i = 0; i < matches.length; i++) {
                if (matches[i].name === endedMatchName) {
                    matches.splice(i,1);
                }
            }

            // send some output
            console.log('Match: ' + endedMatchName + ' ended and removed and players left match.');
        } else {
            // generate a new milkshake location
            milkshake.x = Math.random();
            milkshake.y = Math.random();

            // broadcast new milkshake location and score
            io.to(players[socket.id].match).emit('milkshakeUpdate', milkshake);
            
        }
                
    })

    socket.on('endMatchCleanUpComplete', () => {
        // store the name of the match that ended
        const endedMatchName = players[socket.id].match;

        // remove all sockets from the room that has completed
        io.socketsLeave(endedMatchName);

        // delete the players
        delete players[socket.id];

    })




  });


server.listen(PORT, () => {
    console.log('listening on port localhost:' + PORT);
});
