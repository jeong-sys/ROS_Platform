"use strict";

let remoteVideo = document.getElementById("remoteVideo");
let pc;

const pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const signalingServerUrl = 'http://192.168.50.100:8080'; // 서버 IP 주소와 포트
const socket = io(signalingServerUrl);

socket.on('message', (message) => {
    if (message.type === 'offer') {
        console.log('Received offer, setting remote description and creating answer');
        pc.setRemoteDescription(new RTCSessionDescription(message))
          .then(() => pc.createAnswer())
          .then(setLocalAndSendMessage)
          .catch(onCreateSessionDescriptionError);
    } else if (message.type === 'answer') {
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

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded;
        console.log('PeerConnection created');
    } catch (e) {
        console.error('Failed to create PeerConnection:', e);
        return;
    }
}

function handleIceCandidate(event) {
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

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteVideo.srcObject = event.streams[0];
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

// 시작 시 PeerConnection 생성
createPeerConnection();
