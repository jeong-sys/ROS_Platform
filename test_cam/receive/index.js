const http = require('http');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');

// Create a file server
const fileServer = new nodeStatic.Server();

// Create an HTTP server
const app = http.createServer((req, res) => {
    fileServer.serve(req, res);
}).listen(8080, () => {
    console.log('Server is listening on port 8080');
});

// Create a Socket.IO server and attach it to the HTTP server
const io = socketIO(app);

io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);

    socket.on('message', (message) => {
        console.log('Message received:', message);
        socket.broadcast.emit('message', message); // Broadcast the message to other clients
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});
