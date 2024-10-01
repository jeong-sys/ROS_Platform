'use strict';

const os = require('os');
const nodeStatic = require('node-static');
const http = require('http');
const socketIO = require('socket.io');  // socket.io 가져오기

const fileServer = new nodeStatic.Server();
const port = 3000;

const app = http.createServer((req, res) => {
  fileServer.serve(req, res);
}).listen(port, () => {
  console.log(`Server started on port: ${port}`);

  // 서버 IP 출력 (IPv4)
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(dev => {
    ifaces[dev].forEach(details => {
      if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
        console.log(`Server running at http://${details.address}:${port}`);
      }
    });
  });
});

console.log('Started chatting server...');

// socket.io 서버 생성
const io = socketIO(app);

// 클라이언트 연결 이벤트 처리
io.on('connection', socket => {
  console.log('New client connected: ' + socket.id);

  socket.on('create or join', room => {
    // 방에 있는 클라이언트 수 확인
    const clientsInRoom = io.sockets.adapter.rooms.get(room);
    const numClients = clientsInRoom ? clientsInRoom.size : 0;

    if (numClients === 0) {
      // 방이 없으면 방을 만들고 참가
      socket.join(room);
      socket.room = room;  // 소켓에 방 이름 저장
      socket.emit('created', room, socket.id);
      console.log(`Create room ${room}`);
    } else if (numClients === 1) {
      // 방에 한 명만 있으면 참가
      socket.join(room);
      socket.room = room;  // 소켓에 방 이름 저장
      io.to(room).emit('join', room);  // 방에 있는 클라이언트들에게 알림
      socket.emit('joined', room, socket.id);
      console.log(`Join room ${room}`);
    } else {
      // 방이 꽉 찬 경우 (최대 2명)
      socket.emit('full', room);
      console.log(`full room ${room}`)
    }
  });

  // 메시지 이벤트 처리 - 시그널링 메시지를 방에 있는 다른 클라이언트에게 전달
  socket.on('message', (message) => {
    console.log(`Received message from ${socket.id}: `, message);
    if (socket.room) {
      socket.to(socket.room).emit('message', message);  // 소켓에 저장된 방을 사용
    }
  });

  // 연결이 종료될 때 처리
  socket.on('bye', () => {
    console.log(`Client ${socket.id} disconnected`);
  });
});

