"use strict";

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let pc;
let localStream;

const pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// signalingServerUrl을 환경변수로 설정하는 것도 좋은 방법
const signalingServerUrl = 'http://192.168.50.100:8080'; // 서버의 IP 주소와 포트
const socket = io(signalingServerUrl);

socket.on('message', (message) => {
    if (message.type === 'answer') {
        console.log('Received answer, setting remote description');
        pc.setRemoteDescription(new RTCSessionDescription(message))
          .catch(onCreateSessionDescriptionError);
    } else if (message.type === 'candidate') {
        console.log('Received ICE candidate');
        const candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate)
          .catch(e => console.error('Error adding ICE candidate:', e));
    }
});

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        createPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
    })
    .catch(error => console.error('Error accessing media devices:', error));

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded; // 원격 스트림 핸들러
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected') {
                console.log('ICE connection disconnected.');
            }
        };
        pc.createOffer().then(
            setLocalAndSendMessage,
            onCreateSessionDescriptionError
        );
    } catch (e) {
        console.error('Failed to create PeerConnection:', e);
    }
}

function handleRemoteStreamAdded(event) {
    remoteVideo.srcObject = event.streams[0];
    console.log('Remote stream added.');
}

function sendMessage(message) {
    console.log('Client sending message:', message);
    socket.emit('message', message);
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription)
      .then(() => {
          console.log('Sending local session description');
          sendMessage(sessionDescription);
      })
      .catch(onCreateSessionDescriptionError);
}

function onCreateSessionDescriptionError(error) {
    console.error('Failed to create session description:', error);
}
