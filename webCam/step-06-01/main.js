'use strict';

const wrtc = require('wrtc');  // WebRTC 패키지
const io = require('socket.io-client');  // Socket.IO 클라이언트

// WebRTC 관련 변수
let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let pc;
let dataChannel;

const pcConfig = {
  'iceServers': [
    { 'urls': 'stun:stun.l.google.com:19302' }  // STUN 서버 사용
  ]
};

// Signaling 서버에 연결
const socket = io.connect('http://192.168.219.102:3000');  // Socket.IO 서버 주소 (필요에 맞게 변경)

socket.on('connect', () => {
  console.log('Connected to server, socket id:', socket.id);
});

const room = 'foo';  // 고정된 방 이름

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function(room) {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('Joined: ' + room);
  isChannelReady = true;
});

// Signaling 메시지 수신
socket.on('message', async function(message) {
  console.log('Client received message:', message);
  if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      await maybeStart();
    }
    pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
    await doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    const candidate = new wrtc.RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

// DataChannel 및 PeerConnection 설정
async function maybeStart() {
  if (!isStarted && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    isStarted = true;
    if (isInitiator) {
      await doCall();
    }
  }
}

function createPeerConnection() {
  try {
    pc = new wrtc.RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.ondatachannel = receiveChannelCallback;  // DataChannel 수신 설정
    console.log('Created RTCPeerConnection');
  } catch (e) {
    console.log('Failed to create PeerConnection:', e.message);
    return;
  }
}

// ICE 후보 정보 전송
function handleIceCandidate(event) {
  if (event.candidate) {
    socket.emit('message', {
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  }
}

// Offer 전송
async function doCall() {
  console.log('Creating offer');
  dataChannel = pc.createDataChannel('chat');  // DataChannel 생성
  setupDataChannel();

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('message', offer);
}

// Answer 전송
async function doAnswer() {
  console.log('Sending answer');
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('message', answer);
}

// DataChannel 설정
function setupDataChannel() {
  dataChannel.onopen = () => {
    console.log('Data channel is open');
    dataChannel.send('Hello from ' + (isInitiator ? 'Initiator' : 'Receiver'));
  };

  dataChannel.onmessage = (event) => {
    console.log('Received message:', event.data);
  };
}

function receiveChannelCallback(event) {
  console.log('Received DataChannel');
  dataChannel = event.channel;
  setupDataChannel();
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  isStarted = false;
  pc.close();
  pc = null;
}
