'use strict';

const os = require('os');
const http = require('http');
const socketIO = require('socket.io');

// HTTP 서버 생성
const port = 3000;
const app = http.createServer().listen(port, () => {
  console.log(`Server started on port ${port}`);
  
  // 네트워크 인터페이스 정보 출력
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach((dev) => {
    ifaces[dev].forEach((details) => {
      if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
        console.log(`Server running at http://${details.address}:${port}`);
      }
    });
  });
});

// Socket.IO 설정
const io = socketIO.listen(app);

io.sockets.on('connection', (socket) => {
  socket.on('message', (message) => {
    console.log('Message from client:', message);
    socket.broadcast.emit('message', message);
  });

  socket.on('create or join', (room) => {
    const clientsInRoom = io.sockets.adapter.rooms[room];
    const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;

    if (numClients === 0) {
      socket.join(room);
      socket.emit('created', room);
      console.log(`Created room ${room}`);
    } else if (numClients === 1) {
      socket.join(room);
      io.sockets.in(room).emit('join', room);
      socket.emit('joined', room);
      io.sockets.in(room).emit('ready');
      console.log(`Joined room ${room}`);
    } else {
      socket.emit('full', room);
    }
  });

  socket.on('bye', () => {
    console.log('Received bye');
  });
});
