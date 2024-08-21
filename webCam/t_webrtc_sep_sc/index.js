const http = require('http');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');

// Create a file server
let fileServer = new nodeStatic.Server();

// Create an HTTP server
let app = http.createServer((req, res) => {
    fileServer.serve(req, res);
}).listen(8080, '0.0.0.0', () => {
    console.log('Server is listening on port 8080');
});

// Create a Socket.IO server and attach it to the HTTP server
let io = socketIO(app);

let broadcasters = {}; // 방 별로 방송자를 기록

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('message', (message) => {
        console.log('Received message:', message);
        socket.broadcast.to(message.room).emit('message', message);
    });

    socket.on('create or join', (room) => {
        let clientsInRoom = io.sockets.adapter.rooms.get(room);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;

        if (numClients === 0) {
            console.log('create room!');
            socket.join(room);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            console.log('join room!');
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.to(room).emit('ready');
        } else {
            socket.emit('full', room);
        }
    });

    socket.on('broadcast', (room) => {
        if (!broadcasters[room]) {
            broadcasters[room] = socket.id;
            io.to(room).emit('broadcast', socket.id);
        }
    });

    socket.on('disconnect', () => {
        // 방을 떠나면 방송 상태 초기화
        for (let room in broadcasters) {
            if (broadcasters[room] === socket.id) {
                delete broadcasters[room];
                io.to(room).emit('stopBroadcast');
            }
        }
    });
});
