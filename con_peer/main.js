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
  iceServers: [
  {urls: 'stun:stun.l.google.com:19302'},
  {
    urls: '[turn server]', /////// turn server 설정 //////
    username:'webrtc-server',
    credential:'040416',
  },
  ],
};

const sdpConstraints = {
  offerToReceiveAudio: false,
  offerToReceiveVideo: false
};

// 방 이름 고정
const room = 'foo';

// Signaling 서버에 연결
const socket = io.connect('[signaling ip]'); //// signaling IP ////

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

// Signaling 이벤트 처리
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('join', function(room) {
  console.log('Another peer made a request to join room ' + room);
  isChannelReady = true;
  maybeStart();
});

socket.on('joined', function(room) {
  console.log('Joined room ' + room);
  isChannelReady = true;
  maybeStart();
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('ready', function() {
  console.log('Peer is ready');
  if (isInitiator) {
    maybeStart();
  }
});
socket.on('message', async function (message) {
  console.log('Client received message:', message);

  if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      await maybeStart();
    }
    await pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
    await doAnswer();

  } else if (message.type === 'answer' && isStarted) {
    await pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    if (message.candidate) {  // candidate 값이 유효한지 확인
      var candidate = new wrtc.RTCIceCandidate({
        sdpMLineIndex: message.label,
        sdpMid: message.id,
        candidate: message.candidate
      });
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding received ICE candidate', error);
      }
    } else {
      console.error('Received invalid ICE candidate');
    }
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// WebRTC 연결 초기화 및 시작 함수
async function maybeStart() {
  console.log("isStarted:", isStarted, 'isChannelReady:', isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log("Starting WebRTC connection...");
    createPeerConnection();
    isStarted = true;
    if (isInitiator) {
      await doCall();
    }
  }
}

// PeerConnection 생성
function createPeerConnection() {
  try {
    pc = new wrtc.RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        console.log('WebRTC connection disconnected or failed, cleaning up.');
        handleRemoteHangup();
      }
    };

    if (isInitiator) {
      console.log("This peer is initiator, creating DataChannel");
      dataChannel = pc.createDataChannel('chat');
      setupDataChannel();
    } else {
      pc.ondatachannel = receiveChannelCallback;
      console.log("This peer is non-initiator, waiting for DataChannel");
    }

    console.log('Created RTCPeerConnection');
  } catch (e) {
    console.error('Failed to create PeerConnection:', e);
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
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

// DataChannel 수신 처리
// function receiveChannelCallback(event) {
//   console.log('DataChannel received');
//   dataChannel = event.channel;
  
//   dataChannel.onopen = () => {
//     console.log('DataChannel is open and ready');
//     startChat();
//   };

//   dataChannel.onmessage = (event) => {
//     console.log('Received message:', event.data);
//   };
// }

function receiveChannelCallback(event) {
  console.log('DataChannel received');
  dataChannel = event.channel;  // 받은 DataChannel을 dataChannel로 설정
  setupDataChannel();  // 받은 DataChannel에서 채팅을 시작하도록 설정
}


function setupDataChannel() {
  dataChannel.onopen = function () {
    console.log('Data channel is open');
    startChat();  // DataChannel이 열리면 채팅 시작
  };

  dataChannel.onclose = function () {
    console.log('Data channel is closed');
  };

  dataChannel.onerror = function (error) {
    console.error('Data channel error: ', error);
  };

  dataChannel.onmessage = function (event) {
    console.log('Received message:', event.data);
  };
}

// 채팅 입력 처리
function startChat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  // 데이터 채널이 열려 있을 때만 입력을 처리합니다.
  rl.on('line', (input) => {
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(input);
      // console.log(`You: ${input}`);
    } else {
      console.log('Data channel is not open, cannot send message.');
    }
  });

  // DataChannel이 열리면 채팅을 시작하기 위해 기본 메시지를 출력합니다.
  console.log("Type your message and press Enter:");
}

// Initiator의 DataChannel 생성 및 Offer 전송
async function doCall() {
  console.log('Creating DataChannel for chat');
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendMessage(offer);
}

// Answer 생성
async function doAnswer() {
  const answer = await pc.createAnswer();
  await setLocalAndSendMessage(answer);
}

// Local Description 설정 및 메시지 전송
async function setLocalAndSendMessage(sessionDescription) {
  await pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

// 연결 종료 처리
function handleRemoteHangup() {
  console.log('Remote peer hung up. Closing connection.');
  isStarted = false;
  if (pc) pc.close();
  pc = null;
}
