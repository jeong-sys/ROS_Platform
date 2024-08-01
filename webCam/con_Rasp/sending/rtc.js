"use strict";

let localVideo = document.getElementById("localVideo");
let pc;
let localStream;

const pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// http://<서버 IP 주소>:8080'; // 서버의 IP 주소와 포트
const signalingServerUrl = 'http://your-signaling-server-url'; // signaling 서버 URL
const socket = io.connect(signalingServerUrl);

socket.on('message', (message) => {
    if (message.type === 'offer') {
        pc.setRemoteDescription(new RTCSessionDescription(message));
        pc.createAnswer().then(
            setLocalAndSendMessage,
            onCreateSessionDescriptionError
        );
    } else if (message.type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate') {
        const candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
    }
});

navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
        createPeerConnection();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
    })
    .catch(error => console.error('Error accessing media devices.', error));

function createPeerConnection() {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteStreamAdded;
    pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected') {
            console.log('ICE connection disconnected.');
        }
    };
}

function handleIceCandidate(event) {
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        });
    }
}

function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
}

function sendMessage(message) {
    socket.emit('message', message);
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    console.error('Failed to create session description: ', error);
}
