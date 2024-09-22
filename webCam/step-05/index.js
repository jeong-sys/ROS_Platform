'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

// const https = require("https");
const fs = require('fs')

// const options = {
//   key: fs.readFileSync('./private.pem'),
//   cert: fs.readFileSync('./public.pem')
// };

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(3000);

console.log('Started chating server...');

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)

    // 메시지가 SDP일 경우 네트워크 정보만 추출하여 출력
    if (message.type === 'offer' || message.type === 'answer') {
      const sdpLines = message.sdp.split('\r\n');  // SDP를 줄 단위로 분리
      const networkInfo = sdpLines.filter(line => line.startsWith('c='));  // 'c='로 시작하는 네트워크 정보만 추출

      // 네트워크 정보 출력
      console.log('Network Information from SDP:', networkInfo);
    }
      
    // 화상 채팅 중 한사람이라도 채팅을 나가면(bye)인 경우 채팅방 비우기
    if(message==="bye" && socket.rooms['foo']){
      io.of('/').in('foo').clients((error, socketIds) => {
        if(error) throw error;

        socketIds.forEach(socketId=>{
          io.sockets.sockets[socketId].leave('foo');
        });
      });
    }
    socket.broadcast.emit('message', message);
  });

  // 첫번째 사용자 입장 : create, 두번째 사용자 입장 : join
  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
      console.log('created');

    } else if (numClients === 1) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
      console.log('joined');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

});
