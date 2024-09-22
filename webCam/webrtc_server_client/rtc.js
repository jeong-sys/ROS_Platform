// 연결시, (송신 버튼), (수신 버튼) 누르도록 하기 
// -> 송신 버튼 누른 것만 영상이 찍히고
// -> 수신 버튼 누른 것에는 영상이 보이도록 바꾸기

// 데이터 교환
// 영상 송수신 할 수 있도록 (라즈베리파이에 띄우고 c++ 연결) 
// -> 라즈베리파이에서 영상 송신, 컴퓨터에서 영상 수신(text는 송수신 둘 다 가능하도록), sdp설정 필요
// 영상 송신, 수신 따로 만들기
// 채팅 가능하도록(화상 채팅)

"use strict";

let localVideo = document.getElementById("localVideo");
let remoteVideo = document.getElementById("remoteVideo");
let isInitiator = false;
let isChannelReady = false;
let isStarted = false;
let localStream;
let remoteStream;
let pc;

// 소켓 통신
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
    console.log('This peer is the initiator of room ' + room + '!');
    isChannelReady = true;
});

socket.on('joined', room => {
    console.log('Joined: ' + room);
    isChannelReady = true;
});

socket.on('log', array => {
    console.log.apply(console, array);
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

// signaling서버, 소켓 정보 전송(다른 peer로 데이터 전송)
function sendMessage(message) {
    console.log('Client sending message:', message);
    socket.emit('message', message);
}

// 사용자 미디어 데이터를 스트림으로 받아옴
navigator.mediaDevices
    .getUserMedia({ 
        video: true,
        audio: false,
    })
    .then(gotStream)
    .catch((error) => console.error(error));

// localStream과 localVideo에 출력할 영상 본인 카메라로 지정
function gotStream(stream) {
    console.log("Adding local stream");
    localStream = stream;
    localVideo.srcObject = stream;
    sendMessage("got user media");
    if (isInitiator) {
        maybeStart();
    }
}

// RTC Peer 연결
// RTCPeerConnection에 대한 객체 형성
// iceCandidate(데이터 교환 대상의 EndPoint), iceCandidate 대상 생기면 handleIceCandidate실행
// -> 시그널링 서버로 넘겨주어 상대방 Peer이 내 Stream 연결
function createPeerConnection() {
    try {
        // RTCPeerConnection 객체 생성
        pc = new RTCPeerConnection(pcConfig);

        // ICE 후보 생성 시 호출되는 이벤트 핸들러
        pc.onicecandidate = handleIceCandidate;

        // 원격 스트림 추가 시 호출되는 이벤트 핸들러
        pc.ontrack = handleRemoteStreamAdded;

        // ICE 연결 상태 변경 시 호출되는 이벤트 핸들러
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

function handleCreateOfferError(event) {
    console.log("createOffer() error: ", event);
}

function handleRemoteStreamAdded(event) {
    console.log("Remote stream added");
    remoteStream = event.streams[0]; // 최신 API에서는 streams 배열에서 첫 번째 스트림을 선택
    remoteVideo.srcObject = remoteStream;
}

// 자신의 RTCPeerConnection 초기화, 상대방 RTCPeerConnection 연결
function maybeStart() {
    console.log(">>MaybeStart(): ", isStarted, localStream, isChannelReady);
    if (!isStarted && localStream && isChannelReady) {
        console.log(">>>>> Creating peer connection");
        createPeerConnection();
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream)); // 최신 API에서는 addTrack 사용
        isStarted = true;
        console.log("isInitiator: ", isInitiator);
        if (isInitiator) {
            doCall(); // 연결시, 실행(데이터 주고 받음)
        }
    } else {
        console.error('maybeStart not started! isStarted:',isStarted, 'localStream', !!localStream, 'isChannelReady:', isChannelReady);
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

    // 'o=' 정보만 추출
    let sessionOwner = extractSessionOwnerInfo(sessionDescription.sdp);
    console.log("Session Owner (o=):", sessionOwner);

    // 기존 로직: SDP 설정 및 메시지 전송
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
}

function extractSessionOwnerInfo(sdp) {
    // SDP에서 'o='로 시작하는 세션 주체 정보를 추출하는 정규 표현식
    const sessionOwnerRegex = /^o=([^\r\n]*)/m;
    const match = sdp.match(sessionOwnerRegex);
    
    if (match) {
        return match[0]; // 'o='로 시작하는 전체 라인 반환
    } else {
        return null; // 매칭되는 정보가 없을 경우 null 반환
    }
}

function onCreateSessionDescriptionError(error) {
    console.error("Failed to create session description", error);
}
