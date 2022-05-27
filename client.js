const ICE_SERVERS = [{urls:"stun:stun.l.google.com:19302"}];

var socket = new WebSocket("ws://localhost:4567");
var peers = {};
var self = {
    'layout': {},
    'tracks': {}
};
var printPeers = () => print(JSON.stringify(peers, null, 2));

function send_data(data) {
    socket.send(JSON.stringify(data));
}
function send(peer, type, data) {
    send_data({ ...data, ...{'type': type}, ...{'peer_uuid': peer} });
}
function broadcast(type, data) {
    send_data({ ...data, ...{'type': type} });
}

function addDevices(...devices) {
    for(const [device, type] of devices) {
        self['tracks'][device.id] = device;
        self['layout'][device.id] = type;
    }
    
    broadcastLayout();
    broadcastTracks(devices.map(x => x[0]));
}

function sendVideoDummy() {
    navigator.mediaDevices.getUserMedia(
        {"video": true, "audio": true}
    ).then(stream => {
        addDevices([new MediaStream([stream.getVideoTracks()[0]]), "video"],
                   [new MediaStream([stream.getAudioTracks()[0]]), "audio"]);
    })
}

function sendMessage(peer, type, message) {
    send(peer, 'peerMessage', { 'message': { ...(message || {}), ...{ 'type': type } } })
}
function broadcastMessage(type, message) {
    for(const uuid of Object.keys(peers)) {
        sendMessage(uuid, type, message)
    }
}

function sendLayout(uuid, layout) {
    sendMessage(uuid, 'setLayout', {'layout': layout || self['layout']});
}
function broadcastLayout(layout) {
    broadcastMessage('setLayout', {'layout': layout || self['layout']});
}

function sendTrack(uuid, track) {
    peers[uuid]['connection'].addStream(track);
    updateDescription(uuid);
}
function broadcastTrack(track) {
    for(const uuid of Object.keys(peers)) sendTrack(uuid, track);
}
function sendTracks(uuid, tracks) {
    tracks = Object.values(self['tracks'] || tracks);
    if(tracks.length == 0) return;
    for(const track of tracks) peers[uuid]['connection'].addStream(track);
    updateDescription(uuid);
}
function broadcastTracks(...tracks) {
    for(const uuid of Object.keys(peers)) sendTracks(uuid, tracks);
}

function handlePeerMessage(uuid, message) {
    if(!message['type']) return;
    switch(message['type']) {
        case "setLayout": {
            if(!message['layout']) return;
            peers[uuid]['layout'] = message['layout'];
            applyLayout(uuid);
        } break;
        case "getLayout": {
            sendLayout(uuid);
        } break;
        case "getTracks": {
            sendTracks(uuid);
        }
    }
}

function updateDescription(uuid) {
    const conn = peers[uuid]['connection'];
    conn.createOffer((local_description) => {
        conn.setLocalDescription(local_description, () => {
            send(uuid, 'relaySessionDescription', {
                'session_description': local_description
            });
        }, print)
    }, print);
}

function setup_peer_connection(peer_uuid, dat, connection) {
    connection.onicecandidate = (e) => {
        if(e.candidate) {
            send(peer_uuid, "relayICECandidate", {
                'ice_candidate': {
                    'sdpMLineIndex': e.candidate.sdpMLineIndex,
                    'candidate': e.candidate.candidate
                }
            });
        }
    };
    
    connection.ontrack = (e) => {
        if(!('tracks' in peers[peer_uuid]))
            peers[peer_uuid]['tracks'] = {};
        
        const trackID = e.streams[0].id;
        
        peers[peer_uuid]['tracks'][trackID] = e.track;
        print(`Added track ${trackID} to ${peer_uuid}`)
        applyLayout(peer_uuid)
    };
    
    if(dat['create_offer']) updateDescription(peer_uuid);
}

socket.onopen = () => {
    console.log("Connected to websocket.");
    broadcast('join', {});
};

socket.onmessage = (m) => {
    let dat = JSON.parse(m['data']);
    let peer_uuid = dat['peer_uuid'];
    let log = (x) => print(`${peer_uuid}: ${x} | Total peer count: ${Object.keys(peers).length}`);
    
    if(!(peer_uuid in peers)) {
        peers[peer_uuid] = {};
    }
    
    switch(dat['type']) {
        case "addPeer": {
            let peer_connection = new RTCPeerConnection({"iceServers": ICE_SERVERS})
            peers[peer_uuid] = {'connection': peer_connection}
            setup_peer_connection(peer_uuid, dat, peer_connection);
            sendMessage(peer_uuid, "getLayout");
            setTimeout(() => sendMessage(peer_uuid, "getTracks"), 500);
            log(`+ Peer`);
        } break;
        case "removePeer": {
            if('connection' in peers[peer_uuid])
                peers[peer_uuid]['connection'].close();
            if(peers[peer_uuid]['container']) peers[peer_uuid]['container'].remove();
            delete peers[peer_uuid];
            
            log(`- Peer`);
        } break;
        case "sessionDescription": {
            let peer_connection = peers[peer_uuid]['connection'];
            let remote_description = dat['session_description'];
            
            let description = new RTCSessionDescription(remote_description);
            
            peer_connection.setRemoteDescription(description, () => {
                if(remote_description.type != "offer") return;
                peer_connection.createAnswer((local_description) => {
                    peer_connection.setLocalDescription(local_description, () => {
                        send(peer_uuid, "relaySessionDescription", {
                            'session_description': local_description
                        });
                    }, print)
                }, print)
            }, print)
        } break;
        case "iceCandidate": {
            let iceCandidate = new RTCIceCandidate(dat['ice_candidate']);
            peers[peer_uuid]['connection'].addIceCandidate(iceCandidate);
        } break;
        case "peerMessage": {
            handlePeerMessage(peer_uuid, dat['message'])
        } break;
    }
}