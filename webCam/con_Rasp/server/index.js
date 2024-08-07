// 시그너링 서버 구현

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

// Socket.IO 서버 설정 , cors 설정으로 클라이언트와 서버간 cors문제 해결
let io = socketIO(app, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


// socket 이벤트 처리
io.on('connection', (socket) => { // 클라이언트 연결시 호출, 클라이언트와의 통신 설정
    console.log('A client connected');

    socket.on('message', (message) => { // 클라이언트가 메시지 전송 시 호출, 메시지를 다른 클라이언트에게 브로드캐스트
        console.log('Message received:', message);
        socket.broadcast.emit('message', message); // Broadcast the message to other clients
    });

    socket.on('create or join', (room) => { // 클라이언트 특정 방 생성 및 참여시 호출
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
