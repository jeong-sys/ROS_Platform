const http = require('http');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');

// Create a file server
let fileServer = new nodeStatic.Server();

// Create an HTTP server
let app = http.createServer((req, res) => {
    fileServer.serve(req, res);
}).listen(8080, () => {
    console.log('Server is listening on port 8080');
});

// Create a Socket.IO server and attach it to the HTTP server
let io = socketIO(app);

io.on('connection', (socket) => {
    function log() {
        let array = ['Message from server:'];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }

    socket.on('message', (message) => {
        log('Client said:', message);
        socket.broadcast.emit('message', message);
    });

    socket.on('create or join', (room) => {
        let clientsInRoom = io.sockets.adapter.rooms.get(room);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;
        log('Room ' + room + ' now has ' + numClients + ' client(s)');

        if (numClients === 0) {
            console.log('create room!');
            socket.join(room);
            log('Client ID ' + socket.id + ' created room ' + room);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            console.log('join room!');
            log('Client Id ' + socket.id + ' joined room ' + room);
            io.to(room).emit('join', room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.to(room).emit('ready');
        } else {
            socket.emit('full', room);
        }
    });
});
