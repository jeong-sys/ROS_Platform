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

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected');
    
    socket.on('message', (message) => {
        console.log('Received message:', message);
        socket.broadcast.emit('message', message);
    });

    // Handle room creation and joining (if applicable)
    socket.on('create or join', (room) => {
        let clientsInRoom = io.sockets.adapter.rooms.get(room);
        let numClients = clientsInRoom ? clientsInRoom.size : 0;

        if (numClients === 0) {
            console.log('create room!');
            socket.join(room);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            console.log('join room!');
            io.to(room).emit('join', room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.to(room).emit('ready');
        } else {
            socket.emit('full', room);
        }
        
    });
});
