const SIGNALING_SERVER_URL = window.location.origin;
const PC_CONFIG = {
  iceServers: [
    {urls: 'stun:stun.l.google.com:19302'},
  ]
};
var socket = io(SIGNALING_SERVER_URL, { autoConnect: false, rejectUnauthorized: false});
socket.on('data', (data) => {
  console.log('Data received: ',data);
  handleSignalingData(data);
});

socket.on('ready', () => {
  console.log('Ready');
  createPeerConnection();
  sendOffer();
});

let sendData = (data) => {
  console.log('sending data:',data);
  socket.emit('data', data);
};


var pc;
var localStreamElement = document.querySelector('#localStream');
var remoteStreamElement = document.querySelector('#remoteStream');
const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];
function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}
navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
  attachSinkId(localStreamElement, audioDestination);
}
function attachSinkId(element, sinkId) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId)
        .then(() => {
          console.log(`Success, audio output device attached: ${sinkId}`);
        })
        .catch(error => {
          let errorMessage = error;
          if (error.name === 'SecurityError') {
            errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
          }
          console.error(errorMessage);
          // Jump back to first output device in the list as it's the default.
          audioOutputSelect.selectedIndex = 0;
        });
  } else {
    console.warn('Browser does not support output device selection.');
  }
}

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
  attachSinkId(localStreamElement, audioDestination);
}

function gotStream(stream) {
  window.stream = stream; // make stream available to console
  localStreamElement.srcObject = stream;
  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}
function getLocalStream(){
    if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
      socket.close();
      console.log("source changed")
    });
  }
    const audioSource = audioInputSelect.value;
    const videoSource = videoSelect.value;
    const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices)
    .then(() => {
      console.log('Stream found');
      localStreamElement.srcObject = stream;
      localStream = stream;
      console.log(localStream)
      socket.connect();
      createPeerConnection();

    })
    .catch(handleError);
}

function createPeerConnection(){
  try {
    pc = new RTCPeerConnection(PC_CONFIG);
    pc.onicecandidate = onIceCandidate;
    pc.onaddstream = onAddStream;
    pc.addStream(localStream);
    console.log('PeerConnection created');
  } catch (error) {
    console.error('PeerConnection failed: ', error);
  }
};

function sendOffer(){
  console.log('Send offer');
  pc.createOffer().then(
    setAndSendLocalDescription,
    (error) => { console.error('Send offer failed: ', error); }
  );
};

function sendAnswer(){
  console.log('Send answer');
  pc.createAnswer().then(
    setAndSendLocalDescription,
    (error) => { console.error('Send answer failed: ', error); }
  );
};

function setAndSendLocalDescription(sessionDescription){
  pc.setLocalDescription(sessionDescription);
  console.log('Local description set');
  sendData(sessionDescription);
};

function onIceCandidate(event){
  if (event.candidate) {
    console.log('ICE candidate');
    sendData({
      type: 'candidate',
      candidate: event.candidate
    });
  }
};

function onAddStream(event){
  console.log('Add stream');
  remoteStreamElement.srcObject = event.stream;
};

function handleSignalingData(data){
  switch (data.type) {
    case 'offer':
      createPeerConnection();
      pc.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer();
      break;
    case 'answer':
      pc.setRemoteDescription(new RTCSessionDescription(data));
      break;
    case 'candidate':
      pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      break;
  }
};
function showInfo(){
    document.getElementById("SocketID").innerHTML = socket.id;
};
function socket_refresh(){
 socket.close();
 socket.connect();
}
audioInputSelect.onchange = getLocalStream;
audioOutputSelect.onchange = changeAudioDestination;
videoSelect.onchange = getLocalStream;


