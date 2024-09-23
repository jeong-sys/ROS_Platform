//npm install -g node-pre-gyp(wrtc안깔리는 문제)
//npm install wrtc

'use strict';

const wrtc = require('wrtc');
const io = require('socket.io-client');

// WebRTC 관련 변수
let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let localStream;
let pc;
let dataChannel;

const pcConfig = {
  'iceServers': [
    {'urls': 'stun:stun.l.google.com:19302'}
    // TURN 서버는 필요시 추가
  ]
};

// SDP Constraints
const sdpConstraints = {
  offerToReceiveAudio: false,
  offerToReceiveVideo: false
};

/////////////////////////////////////////////

const room = 'foo'; // 고정된 방 이름

// Signaling 서버에 연결
const socket = io.connect('http://192.168.50.140:3000'); // signaling 서버 주소
// var socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

socket.on('created', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function (room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
});

socket.on('joined', function (room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function (array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// Signaling 메시지 수신
socket.on('message', async function (message) {
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

async function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, isChannelReady);
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
    pc.ondatachannel = receiveChannelCallback; // DataChannel 수신 설정
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    return;
  }
}

// ICE 후보 정보 전송
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    console.log('Sending ICE candidate');
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
  
}

async function doCall() {
  console.log('Sending offer to peer');
  dataChannel = pc.createDataChannel('chat'); // DataChannel 생성
  setupDataChannel();

  try {
    const offer = await pc.createOffer(sdpConstraints);
    console.log('Offer created:', offer);
    await setLocalAndSendMessage(offer);
  } catch (error) {
    console.error('Error during offer creation:', error);
  }
}


async function doAnswer() {
  console.log('Sending answer to peer.');
  const answer = await pc.createAnswer();
  await setLocalAndSendMessage(answer);
}

async function setLocalAndSendMessage(sessionDescription) {
  await pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

function setupDataChannel() {
  dataChannel.onopen = function () {
    console.log('Data channel is open');
  };

  dataChannel.onmessage = function (event) {
    console.log('Received message: ', event.data);
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
