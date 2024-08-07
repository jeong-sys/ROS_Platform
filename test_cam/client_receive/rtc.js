"use strict";

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let isInitiator = false; // PC2에서는 false로 설정
let isChannelReady = false;
let isStarted = false;
let localStream;
let remoteStream;
let pc;

let pcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

let room = 'foo';

// let serverURL = 'http://localhost:8080'; // 로컬 테스트
let serverURL = 'http://172.26.1.27:8080'; // 공용 IP에서 실행 시

let socket = io.connect(serverURL);

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
    console.log('This peer is the initiator of room ' + room + '!');
    isChannelReady = true;
});

socket.on('joined', room => {
    console.log('Joined: ' + room);
    isChannelReady = true;
});

socket.on('message', (message) => {
    console.log('Client received message:', message);
    if (message === 'got user media') {
        maybeStart();
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
    socket.emit('message', message);
}

// 비디오 캡처 설정 (PC2에서는 비디오 캡처가 필요 없음)
function start() {
    navigator.mediaDevices
        .getUserMedia({
            video: false,
            audio: false,
        })
        .then(() => console.log("Started video capturing"))
        .catch((error) => console.error(error));
}

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(pcConfig);
        pc.onicecandidate = handleIceCandidate;
        pc.ontrack = handleRemoteStreamAdded;
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
    console.log(">>MaybeStart(): ", isStarted, localStream, isChannelReady);
    if (!isStarted && isChannelReady) {
        console.log(">>>>> Creating peer connection");
        createPeerConnection();
        isStarted = true;
        console.log("isInitiator: ", isInitiator);
        if (!isInitiator) {
            doCall();
        }
    } else {
        console.error('maybeStart not started!');
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

function handleCreateOfferError(event) {
    console.log("createOffer() error: ", event);
}

function onCreateSessionDescriptionError(error) {
    console.error("Failed to create session description", error);
}

start();
