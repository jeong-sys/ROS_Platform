const http = require('http');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');
const cors = require('cors'); // CORS 모듈 추가

// Create a file server
let fileServer = new nodeStatic.Server();

// Create an HTTP server
let app = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // CORS 헤더 추가
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    fileServer.serve(req, res);
}).listen(8080, () => {
    console.log('Server is listening on port 8080');
});

// Create a Socket.IO server and attach it to the HTTP server
let io = socketIO(app, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('A client connected');

    socket.on('message', (message) => {
        console.log('Message received:', message);
        socket.broadcast.emit('message', message); // Broadcast the message to other clients
    });

    socket.on('create or join', (room) => {
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

        if (numClients === 0) {
            console.log('Creating room!');
            socket.join(room);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            console.log('Joining room!');
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.to(room).emit('ready');
        } else {
            socket.emit('full', room);
        }
    });
});
