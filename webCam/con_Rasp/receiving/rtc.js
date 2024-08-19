"use strict";

// 다른 컴퓨터에서 접근 불가

let remoteVideo = document.getElementById("remoteVideo");
let pc;

const pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

const signalingServerUrl = 'http://[ip]:8080'; // 서버의 IP 주소와 포트
const socket = io(signalingServerUrl);

socket.on('message', (message) => {
    if (message.type === 'offer') {
        console.log('Received offer, setting remote description and creating answer');
        if (pc.signalingState !== 'stable') {
            console.error('Received offer in unexpected state:', pc.signalingState);
            return;
        }

        pc.setRemoteDescription(new RTCSessionDescription(message))
        .then(() => {
            console.log('Signaling state after setting remote description:', pc.signalingState);
            return pc.createAnswer();
        })
        .then(answer => {
            if (answer) setLocalAndSendMessage(answer);
        })
        .catch(onCreateSessionDescriptionError);

    } else if (message.type === 'answer') {
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

// RTCPeerConnection생성을 통한 webRTC 연결 설정
function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded; // Ensure this is set correctly
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected') {
                console.log('ICE connection disconnected.');
            }
        };
        console.log('PeerConnection created');
    } catch (e) {
        console.error('Failed to create PeerConnection:', e);
        return;
    }
}

// ICE 후보 수신하고 상대방에게 전송
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

// 수신된 비디오 스트림 <video> 요소에 연결하여 표시
function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
    } else if (event.track) {
        // Create a new MediaStream if only a single track is received
        let stream = new MediaStream();
        stream.addTrack(event.track);
        remoteVideo.srcObject = stream;
    } else {
        console.error('No streams or tracks found in the event.');
    }
}

// socket사용하여 서버에 메시지 전달
function sendMessage(message) { // 동작 안함 , 비디오부터 동작되지 않음
    console.log('Client sending message:', message);
    socket.emit('message', message);
}

// 로컬 세션 설명 설정 후 상대에게 전송
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

// 연결 시작
function start() {
    createPeerConnection();
    // No need to create offer on the receiving side
}

// Start the process
start();
