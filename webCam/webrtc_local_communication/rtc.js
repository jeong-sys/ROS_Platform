"use strict";

let dataChannelSend = document.getElementById("dataChannelSend");
let dataChannelReceive = document.getElementById("dataChannelReceive");
let sendBtn = document.getElementById("send");
let localConnection;
let remoteConnection;
let sendChannel;
let receiveChannel;

sendBtn.onclick = sendData;

createConnection();

function createConnection() {
    const servers = null; // STUN/TURN 서버 설정 필요시 추가
    const pcConfig = {}; // Optional RTC configuration

    // Create local peer connection
    localConnection = new RTCPeerConnection(servers, pcConfig);
    
    // Create data channel on local connection
    sendChannel = localConnection.createDataChannel("sendDataChannel");
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;

    // Set up ICE candidate handling for local connection
    localConnection.onicecandidate = (event) => {
        if (event.candidate) {
            remoteConnection.addIceCandidate(event.candidate)
                .then(() => console.log("Local ICE candidate added to remote connection"))
                .catch(error => console.error("Error adding ICE candidate: ", error));
        }
    };

    // Create remote peer connection
    remoteConnection = new RTCPeerConnection(servers, pcConfig);
    remoteConnection.onicecandidate = (event) => {
        if (event.candidate) {
            localConnection.addIceCandidate(event.candidate)
                .then(() => console.log("Remote ICE candidate added to local connection"))
                .catch(error => console.error("Error adding ICE candidate: ", error));
        }
    };
    remoteConnection.ondatachannel = receiveChannelCallback;

    // Create and send offer
    localConnection.createOffer()
        .then(desc => localConnection.setLocalDescription(desc))
        .then(() => remoteConnection.setRemoteDescription(localConnection.localDescription))
        .then(() => remoteConnection.createAnswer())
        .then(desc => remoteConnection.setLocalDescription(desc))
        .then(() => localConnection.setRemoteDescription(remoteConnection.localDescription))
        .catch(error => console.error("Error in SDP exchange: ", error));
}

function onSendChannelStateChange() {
    const readyState = sendChannel.readyState;
    if (readyState === "open") {
        console.log('Send channel state is: open');
    } else {
        console.log('Send channel state is: closed');
    }
}

function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
}

function onReceiveMessageCallback(event) {
    dataChannelReceive.value = event.data;
}

function sendData() {
    const data = dataChannelSend.value;
    console.log('Sending data:', data);
    sendChannel.send(data);
}

function onCreateSessionDescriptionError(error) {
    console.error('Failed to create session description: ', error.toString());
}
