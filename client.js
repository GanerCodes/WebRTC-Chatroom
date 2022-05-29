const ICE_SERVERS = [{urls:"stun:stun.l.google.com:19302"}];

var socket = new WebSocket("ws://localhost:4567");
if(window.location.hash == "") window.location.hash = crypto.randomUUID();
var room_name = window.location.hash;

var peers = {};
var self = {
    'layout': {},
    'tracks': {}
};
var printPeers = () => print(JSON.stringify(peers, null, 2));
var printLog = (uuid, m) => print(`${uuid}: ${m}`);

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
    for(const [device, type, name] of devices) {
        if(name) device.name = name;
        self['tracks'][device.id] = device;
        self['layout'][device.id] = type;
        addSelfPreview(device.id, type);
    }
    
    broadcastLayout();
    broadcastTracks(devices.map(x => x[0]));
}

function sendMessage(peer, type, message) {
    send(peer, 'peerMessage', { 'message': { ...(message || {}), ...{ 'type': type } } })
}
function broadcastMessage(type, message) {
    for(const uuid of Object.keys(peers)) sendMessage(uuid, type, message);
}

function removeTrack(uuid, trackID) {
    sendMessage(uuid, 'removeTrack', {'trackID': trackID});
}
function broadcastRemoveTrack(trackID) {
    broadcastMessage('removeTrack', {'trackID': trackID});
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
            printLog(uuid, "Setting layout.")
        } break;
        case "getLayout": {
            sendLayout(uuid);
        } break;
        case "getTracks": {
            sendTracks(uuid);
        } break;
        case "removeTrack": {
            if(!message['trackID']) return;
            const id = message['trackID'];
            if(id in peers[uuid]['tracks']) delete peers[uuid]['tracks'][id];
            if(id in peers[uuid]['layout']) delete peers[uuid]['layout'][id];
        } break;
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

function register_peer(uuid, dat) {
    let peer_connection = new RTCPeerConnection({"iceServers": ICE_SERVERS})
    peers[uuid] = {'connection': peer_connection}
    setup_peer_connection(uuid, dat, peer_connection);
    sendMessage(uuid, "getLayout");
    setTimeout(() => sendMessage(uuid, "getTracks"), 500);
    updateUserListText();
}

function unregister_peer(uuid) {
    if('connection' in peers[uuid])
        peers[uuid]['connection'].close();
    if(peers[uuid]['container']) peers[uuid]['container'].remove();
    delete peers[uuid];
    updateUserListText();
}

socket.onopen = () => {
    console.log("Connected to websocket.");
    broadcast('join', {'room': room_name});
    document.getElementById("roomNameText").innerHTML = `Room: "${room_name}"`;
    updateUserListText();
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
            register_peer(peer_uuid, dat);
            log(`+ Peer`);
        } break;
        case "removePeer": {
            unregister_peer(peer_uuid);
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