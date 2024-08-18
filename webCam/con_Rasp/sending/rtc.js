"use strict";

let localVideo = document.getElementById("localVideo");
let pc;
let localStream;

const pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const signalingServerUrl = 'http://192.168.219.102:8080'; // 서버의 IP 주소와 포트
const socket = io(signalingServerUrl);

socket.on('message', (message) => {
    if (message.type === 'answer') {
        console.log('Received answer, setting remote description');
        if (pc.signalingState !== 'have-local-offer') {
            console.error('Received answer in unexpected state:', pc.signalingState);
            return;
        }
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
    .catch(error => console.error('Error accessing media devices.', error));

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded; // This might not be necessary for the sending side
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected') {
                console.log('ICE connection disconnected.');
            }
        };
        console.log('PeerConnection created');

        // Create an offer and set it as the local description
        pc.createOffer().then(
            setLocalAndSendMessage,
            onCreateSessionDescriptionError
        );
    } catch (e) {
        console.error('Failed to create PeerConnection:', e);
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
    console.log('Remote stream added.'); // This is not needed for the sending side
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
