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

socket.on('join', function(room) {
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
    console.log('Received offer:', message);
    if (!isInitiator && !isStarted) {
      console.log('Not initiator and not started, starting WebRTC connection to answer offer');
      await maybeStart();
    }
    await pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));
    await doAnswer();

  } else if (message.type === 'answer' && isStarted) {
    console.log('Received answer:', message);
    await pc.setRemoteDescription(new wrtc.RTCSessionDescription(message));

  } else if (message.type === 'candidate' && isStarted) {
    console.log('Received ICE candidate:', message);

    try {
      if (pc.remoteDescription) {
        const candidate = new wrtc.RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate
        });

        // TCP 패시브 후보 무시
        if (candidate.candidate.includes('tcp') && candidate.candidate.includes('passive')) {
          console.log('Ignoring TCP passive candidate:', candidate);
        } else if (candidate.candidate.includes('127.0.0.1') || candidate.candidate.includes('::1')) {
          console.log('Ignoring localhost candidate:', candidate);
        } else {
          await pc.addIceCandidate(candidate);
          console.log('Successfully added ICE candidate');
        }

      } else {
        console.log("Remote description not set, cannot add ICE candidate yet");
      }
    } catch (error) {
      console.error('Error adding received ICE candidate: ', error);
    }

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
// function createPeerConnection() {
//   try {
//     pc = new wrtc.RTCPeerConnection(pcConfig);
//     pc.onicecandidate = handleIceCandidate;
//     pc.ondatachannel = receiveChannelCallback;
//     console.log('Created RTCPeerConnection');
//   } catch (e) {
//     console.error('Failed to create PeerConnection:', e);
//     return;
//   }
// }

function createPeerConnection() {
  try {
    pc = new wrtc.RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;

    if (isInitiator) {
      console.log("This peer is initiator, creating DataChannel");
      dataChannel = pc.createDataChannel('chat');  // Initiator만 DataChannel 생성
      setupDataChannel();  // Initiator에서만 데이터 채널 설정
    } else {
      pc.ondatachannel = receiveChannelCallback;  // Non-Initiator는 DataChannel 수신 처리
      console.log("This peer is non-initiator, waiting for DataChannel");
    }

    console.log('Created RTCPeerConnection');
  } catch (e) {
    console.error('Failed to create PeerConnection:', e);
    return;
  }
}

// ICE 후보 처리
function handleIceCandidate(event) {
  if (event.candidate) {
    // TCP 패시브 후보 무시 및 기타 불필요한 후보 무시
    if (event.candidate.candidate.includes('tcp') && event.candidate.candidate.includes('passive')) {
      console.log('Ignoring TCP passive candidate:', event.candidate);
    } else if (event.candidate.candidate.includes('127.0.0.1') || event.candidate.candidate.includes('::1')) {
      console.log('Ignoring localhost candidate:', event.candidate);
    } else {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    }
  } else {
    console.log('End of candidates.');
  }
}

// DataChannel 수신 처리 (비 Initiator)
function receiveChannelCallback(event) {
  console.log('DataChannel received');
  dataChannel = event.channel;
  
  // 데이터 채널이 열린 이후 채팅을 시작하도록 변경
  dataChannel.onopen = () => {
    console.log('DataChannel is open and ready');
    startChat();
  };

  dataChannel.onmessage = (event) => {
    console.log('Received message:', event.data);
  };
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

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('message', offer);
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
