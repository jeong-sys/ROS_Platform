'use strict';

const wrtc = require('wrtc');
const io = require('socket.io-client');
const readline = require('readline');  // 채팅 입력을 받기 위한 모듈

// WebRTC 관련 변수
let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let pc;
let dataChannel;

const pcConfig = {
  'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]
};

const sdpConstraints = {
  offerToReceiveAudio: false,
  offerToReceiveVideo: false
};

const room = 'foo'; // 방 이름 고정

// Signaling 서버에 연결
const socket = io.connect('http://127.0.0.1:3000'); // Signaling 서버 주소

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

// Signaling 이벤트 처리
socket.on('created', function (room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('join', function (room) {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
  maybeStart();
});

socket.on('joined', function (room) {
  console.log('Joined room ' + room);
  isChannelReady = true;
  maybeStart();
});

socket.on('message', async function (message) {
  console.log('Client received message:', message);

  if (message.type === 'offer') {
    console.log('Received offer:',message);
    if (!isInitiator && !isStarted) {
      console.log('Not initiator and not started, starting webRTC connection to answer offer')
      await maybeStart();
    }
    pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
    await doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    console.log('Received anser:', message)
    pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    console.log('Received ICE candidate:', message)
    const candidate = new wrtc.RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

function sendMessage(message) {
  socket.emit('message', message);
}

// WebRTC 연결 초기화 및 시작 함수
async function maybeStart() {
  console.log("isStarted:", isStarted, 'isChannelReady:',isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log("Starting WebRTC connection...");
    createPeerConnection();
    isStarted = true;
    if (isInitiator) {
      await doCall();
    }
  } else {
    console.log("maybeStart conditions not met: isStarted=",isStarted, ",isChannelReady", isChannelReady)
  }
}

// PeerConnection 생성
function createPeerConnection() {
  try {
    pc = new wrtc.RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.ondatachannel = receiveChannelCallback;
    console.log('Created RTCPeerConnection');
  } catch (e) {
    console.error('Failed to create PeerConnection:', e);
    return;
  }
}

// ICE 후보 처리
function handleIceCandidate(event) {
  if (event.candidate) {
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

// DataChannel 수신 처리 (비 Initiator)
function receiveChannelCallback(event) {
  console.log('DataChannel received');  ///////////////////////// 여기서부터 안됨
  dataChannel = event.channel;
  setupDataChannel();
}

// DataChannel 설정
function setupDataChannel() {
  dataChannel.onopen = function () {
    console.log('Data channel is open');
    startChat();  // 채팅 입력 대기
  };

  dataChannel.onclose = function () {
    console.log('Data channel is closed');
  };

  dataChannel.onerror = function (error) {
    console.error('Data channel error: ', error);
  };

  dataChannel.onmessage = function (event) {
    console.log('Received message:', event.data);  // 수신 메시지 출력
  };
}

// 채팅 입력 처리
function startChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', (input) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(input);
      console.log(`You: ${input}`);
    } else {
      console.log('Data channel is not open, cannot send message.');
    }
  });
}

// Initiator의 DataChannel 생성 및 Offer 전송
async function doCall() {
  console.log('Creating DataChannel for chat');
  dataChannel = pc.createDataChannel('chat');
  setupDataChannel();

  try {
    const offer = await pc.createOffer(sdpConstraints);
    console.log('Offer created:', offer);
    await setLocalAndSendMessage(offer);
  } catch (error) {
    console.error('Error during offer creation:', error);
  }
}

// Answer 생성
async function doAnswer() {
  const answer = await pc.createAnswer();
  await setLocalAndSendMessage(answer);
}

// Local Description 설정 및 메시지 전송
async function setLocalAndSendMessage(sessionDescription) {
  console.log('Setting local description and sending message:', sessionDescription);  // Local Description 설정 및 메시지 전송 로그 추가
  await pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
  console.log('Client sending message: ', sessionDescription);  // Signaling 서버로 메시지 전송 로그 추가
}


// 연결 종료 처리
function handleRemoteHangup() {
  console.log('Remote peer hung up. Closing connection.');
  isStarted = false;
  if (pc) pc.close();
  pc = null;
}
