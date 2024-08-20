"use strict";

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let isInitiator = false;
let isChannelReady = false;
let isStarted = false;
let localStream;
let remoteStream;
let pc;
let broadcasterId;

let pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let room = 'test_rtc';
let socket = io.connect();

if (room !== '') {
    socket.emit('create or join', room);
    console.log('Attempted to create or join Room', room);
}

socket.on('created', (room, id) => {
    console.log('Created room ' + room + ' socket ID: ' + id);
    isInitiator = true;
});

socket.on('full', room => {
    console.log('Room ' + room + ' is full');
});

socket.on('join', room => {
    console.log('Another peer made a request to join room ' + room);
    isChannelReady = true;
});

socket.on('joined', room => {
    console.log('Joined: ' + room);
    isChannelReady = true;
});

socket.on('broadcast', (id) => {
    broadcasterId = id;
    console.log('Receiving broadcast from:', id);
    if (socket.id !== id) {  // 다른 클라이언트에서만 수신
        maybeStart();  // 방송 시작 시 자동으로 연결 시작
    } else {
        initializeStream();  // 송신자는 방송 시작
    }
});

socket.on('stopBroadcast', () => {
    console.log('Broadcasting stopped');
    isStarted = false;
    if (pc) {
        pc.close();
        pc = null;
    }
});

socket.on('message', (message) => {
    console.log('Client received message:', message);
    if (message.type === 'got user media') {
        if (broadcasterId === socket.id) {
            maybeStart();
        }
    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        const candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
    }
});

function sendMessage(message) {
    console.log('Client sending message:', message);
    socket.emit('message', { ...message, room });
}

function initializeStream() {
    navigator.mediaDevices
        .getUserMedia({ 
            video: true,
            audio: false,
        })
        .then((stream) => {
            localStream = stream;
            localVideo.srcObject = stream;  // 방송자에게만 로컬 비디오 표시
            sendMessage({ type: 'got user media' });
        })
        .catch((error) => console.error(error));
}

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded;
        pc.oniceconnectionstatechange = function(event) {
            console.log('ICE connection state: ', pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log('ICE connection established!');
            } else if (pc.iceConnectionState === 'failed') {
                console.error('ICE connection failed');
            }
        };
        console.log("Created RTCPeerConnection");
    } catch (e) {
        alert("Cannot create RTCPeerConnection object");
        return;
    }
}

function handleIceCandidate(event) {
    console.log("iceCandidateEvent", event);
    if (event.candidate) {
        sendMessage({
            type: "candidate",
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate,
        });
    } else {
        console.log("End of candidates");
    }
}

function handleRemoteStreamAdded(event) {
    console.log("Remote stream added");
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
}

function maybeStart() {
    if (!isStarted && broadcasterId && isChannelReady) {
        console.log(">>>>> Creating peer connection");
        createPeerConnection();
        if (socket.id === broadcasterId) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }
        isStarted = true;
        if (socket.id === broadcasterId) {
            doCall();
        }
    }
}

function doCall() {
    console.log("Sending offer to peer");
    pc.createOffer().then(
        setLocalAndSendMessage,
        handleCreateOfferError
    );
}

function doAnswer() {
    console.log("Sending answer to peer");
    pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
    );
}

function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
    console.error("Failed to create session description", error);
}

// 송신 버튼 클릭 시 방송 시작
document.getElementById('startBroadcast').addEventListener('click', () => {
    if (!broadcasterId) {
        broadcasterId = socket.id;  // 본인이 방송자임을 설정
        socket.emit('broadcast', room);
    }
});
