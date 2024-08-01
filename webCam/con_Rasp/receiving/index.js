const http = require('http');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');

let fileServer = new nodeStatic.Server();
const port = process.env.PORT || 8080;

let app = http.createServer((req, res) => {
    fileServer.serve(req, res);
}).listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

let io = socketIO(app);

io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);

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
        try {
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
                log('Client ID ' + socket.id + ' joined room ' + room);
                io.to(room).emit('join', room);
                socket.join(room);
                socket.emit('joined', room, socket.id);
                io.to(room).emit('ready');
            } else {
                socket.emit('full', room);
            }
        } catch (error) {
            console.error('Error in create or join:', error);
            socket.emit('error', 'An error occurred during create or join');
        }
    });

    socket.on('disconnect', () => {
        console.log('A client disconnected:', socket.id);
    });
});
