'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
const fs = require('fs');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(3000);

console.log('Started chatting server...');

var io = socketIO(app);

io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);

    // 메시지가 SDP일 경우 네트워크 정보만 추출하여 출력
    if (message.type === 'offer' || message.type === 'answer') {
      const sdpLines = message.sdp.split('\r\n');  // SDP를 줄 단위로 분리
      const networkInfo = sdpLines.filter(line => line.startsWith('c='));  // 'c='로 시작하는 네트워크 정보만 추출

      // 네트워크 정보 출력
      console.log('Network Information from SDP:', networkInfo);
    }
      
    // 화상 채팅 중 한사람이라도 채팅을 나가면(bye)인 경우 채팅방 비우기
    if(message === "bye" && socket.room) {
      io.of('/').in(socket.room).clients((error, socketIds) => {
        if (error) throw error;

        socketIds.forEach(socketId => {
          io.sockets.sockets.get(socketId).leave(socket.room);
        });
      });
    }

    // 방에 있는 다른 모든 클라이언트에게 메시지 브로드캐스트
    socket.broadcast.to(socket.room).emit('message', message);
  });

  // 첫번째 사용자 입장 : create, 두번째 사용자 입장 : join
  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    // 최신 방식으로 방에 있는 클라이언트 수 확인
    const clientsInRoom = io.sockets.adapter.rooms.get(room);  // 최신 방식
    const numClients = clientsInRoom ? clientsInRoom.size : 0;  // 방에 클라이언트가 몇 명 있는지 확인
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      socket.room = room;  // 소켓에 방 이름 저장
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
      console.log('created');
    } else if (numClients === 1) {
      socket.join(room);
      socket.room = room;  // 소켓에 방 이름 저장
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);  // 방에 있는 클라이언트들에게 알림
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');  // 클라이언트들끼리 준비 완료
      console.log('joined');
    } else {  // 방에 클라이언트가 두 명 이상이면 참가 거부
      socket.emit('full', room);
    }
  });

  // 클라이언트가 IP 주소를 요청할 때 처리
  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '0.0.0.0') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  // 클라이언트가 방을 나갈 때 처리
  socket.on('bye', function() {
    console.log('received bye');

    // 클라이언트가 떠날 때 방에서 제거
    if (socket.room) {
      socket.leave(socket.room);
      console.log(`Client ${socket.id} left room ${socket.room}`);

      // 남아있는 클라이언트가 없을 경우 방을 정리
      const clientsInRoom = io.sockets.adapter.rooms.get(socket.room);
      const numClients = clientsInRoom ? clientsInRoom.size : 0;
      if (numClients === 0) {
        console.log(`Room ${socket.room} is now empty.`);
      }
    }
  });

  // 연결이 종료될 때 처리
  socket.on('disconnect', function() {
    console.log('Client disconnected');

    // 연결 해제 시에도 방을 나갈 수 있도록 처리
    if (socket.room) {
      socket.leave(socket.room);
      console.log(`Client ${socket.id} disconnected from room ${socket.room}`);
    }
  });
});
