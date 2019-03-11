const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3001;

app.use(express.static(__dirname + '/public'));
var fs = require("fs");

let randomWord;

function onConnection(socket) {
    let roomClientIsIn = null;
    let score = 0;

    socket.on('new-room', function() {
        socket.join(socket.nickname);
        roomClientIsIn =  Object.keys(io.sockets.adapter.sids[socket.id]).filter(item => item!=socket.id);
        console.log(socket.nickname + "made a new room");
    });

    socket.on('get-room', function() {
        socket.emit('rooms', findRooms());
    });

    socket.on('join-room', function(room) {
        socket.join(room);
        roomClientIsIn =  Object.keys(io.sockets.adapter.sids[socket.id]).filter(item => item!=socket.id);
        console.log(socket.nickname + "joined room" + room);
    });

    socket.on('drawing', function (data) {
        socket.broadcast.to(roomClientIsIn).emit('drawing', data);
    });

    socket.on('clear', function () {
        io.to(roomClientIsIn).emit('clear');
    });

    socket.on('disconnect', function () {
        let clientsInRoom = getClientsInRoom();
        io.to(roomClientIsIn).emit('users-changed', {user: socket.nickname, event: 'left', clientsInRoom: clientsInRoom});
    });

    socket.on('set-nickname', (nickname) => {
        socket.nickname = nickname;
        let clientsInRoom = getClientsInRoom(roomClientIsIn);
        io.emit('users-changed', {user: nickname, event: 'joined', clientsInRoom: clientsInRoom});
    });

    socket.on('add-message', (message) => {
        io.emit('message', {text: message.text, from: socket.nickname, created: new Date()});
        console.log("added");
    });

    socket.on('game-start', () => {
        console.log(getClientsInRoom(roomClientIsIn));
        if(getSockets(roomClientIsIn).length > 0){
            let indexOfClient = getRandomClient(Object.keys(getClientsInRoom(roomClientIsIn)));
            getRandomWord().then((word) => {
                randomWord = word;
                console.log("GameStarted!");
                getSockets(roomClientIsIn).forEach(function (socket, index) {
                    if (index !== indexOfClient) {
                        socket.emit('round-started-guess');
                    } else {
                        socket.emit('round-started-draw', {randomWord: randomWord});
                    }
                });
            });
        }
    });

    socket.on('round-guess', (message) => {
        if (message.text.toLowerCase().trim() != randomWord.toLowerCase().trim()) {
            socket.broadcast.to(roomClientIsIn).emit('round-guessed', {text: message.text, from: socket.nickname});
        } else {
            console.log("GameOver!");
            score++;
            io.emit('round-over', {winner: socket.nickname, text: 'The word was ' + message.text});
        }
    });

}

io.on('connection', onConnection);

http.listen(port, () => console.log('listening on port ' + port));

function getRandomClient(clients) {
    return Math.floor(Math.random() * 0) + (clients.length - 1);
}

function getRandomWord() {
    return new Promise((resolve) => {
        fs.readFile('assets/words.txt', function (err, data) {
            if (err) throw err;
            var lines = data.toString().split('\n');
            resolve(lines[Math.floor(Math.random() * lines.length)]);
        });
    });
}

function getSockets(room) { // will return all sockets with room name
    return Object.entries(io.sockets.adapter.rooms[room] === undefined ?
        {} : io.sockets.adapter.rooms[room].sockets )
        .filter(([id, status]) => status) // get only status = true sockets
        .map(([id]) => io.sockets.connected[id])
}

function getClientsInRoom(roomClientIsIn) {
    if(roomClientIsIn != null){
        var clientsInRoom = [];
        getSockets(roomClientIsIn).forEach( (client, key) => {
            clientsInRoom.push({name: client.nickname});
        });
    }
    return clientsInRoom;
}

function findRooms() {
    var availableRooms = [];
    var rooms = io.sockets.adapter.rooms;
    if (rooms) {
        for (var room in rooms) {
            if (!rooms[room].sockets.hasOwnProperty(room)) {
                availableRooms.push(room);
            }
        }
    }
    return availableRooms;
}
