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
    console.log('A client connected:', socket.id);

    // Handle messages from clients
    socket.on('message', (message) => {
        console.log('Message received from', socket.id, ':', message);
        socket.broadcast.emit('message', message); // Broadcast the message to other clients
    });

    // Handle room creation and joining
    socket.on('create or join', (room) => {
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        console.log('Room ' + room + ' now has ' + numClients + ' client(s)');

        if (numClients === 0) {
            console.log('Creating room ' + room);
            socket.join(room);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            console.log('Joining room ' + room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.to(room).emit('ready');
        } else {
            console.log('Room ' + room + ' is full');
            socket.emit('full', room);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
