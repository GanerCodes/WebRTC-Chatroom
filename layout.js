function createTrackContainer(uuid) {
    const elm = document.createElement("div");
    
    elm.setAttribute("id", uuid);
    elm.className = "trackContainer";
    return elm;
}

function createTrackElement(track, id, type) {
    let elm;
    if(type == "video") {
        elm = document.createElement("video");
        elm.muted = true;
    }else{
        elm = document.createElement("audio");
        elm.muted = false;
    }
    
    elm.setAttribute("autoplay", true);
    elm.srcObject = new MediaStream([track]);
    
    elm.setAttribute("id", id)
    elm.className = "track audioTrack";
    return elm;
}

function addSelfPreview(trackID) {
    const selfContainer = document.getElementById("selfContainer");
    const device = self['tracks'][trackID];
    const elm = document.createElement("video");
    
    elm.setAttribute("autoplay", true);
    elm.muted = true;
    
    elm.srcObject = device;
    elm.setAttribute("id", trackID)
    elm.className = "selfTrack";
    
    selfContainer.appendChild(elm);
}

function applyLayout(uuid, layout) {
    const streamContainer = document.getElementById("streamContainer");
    
    layout = layout || peers[uuid]['layout'];
    const peer_tracks = peers[uuid]['tracks'] || {};
    
    const l_b = Object.keys(layout).length;
    const p_b = Object.keys(peer_tracks).length;
    
    let container = document.getElementById(uuid)
    if(container && (!l_b || !p_b)) {
        container.remove();
        return;
    }else if(!container && l_b && p_b) {
        container = createTrackContainer(uuid);
        peers[uuid]['container'] = container;
        streamContainer.appendChild(container);
    }else if(!container) {
        return;
    }
    
    const currentTrackElements = container.getElementsByClassName("track");
    for(const elm of currentTrackElements) {
        if(!(elm.id in peer_tracks)) elm.remove();
    }
    
    for(const [id, type] of Object.entries(layout)) {
        if(!peer_tracks[id]) continue;
        
        if(document.getElementById(id)) continue;
        const track = peer_tracks[id];
        print(`Adding ${type} (${id}) to layout.`)
        container.appendChild(createTrackElement(track, id, type))
    }
}

function applyLayouts() {
    for(const uuid of Object.keys(peers)) applyLayout(uuid);
    removeDisconnectedStreamElements();
}

function removeDisconnectedStreamElements() {
    for(const elm of document.getElementById("trackContainer")) {
        if(!(elm.id in peers)) elm.remove();
    }
}

function addSourcePrompt(type) {
    if(type == "scr") {
        navigator.mediaDevices.getDisplayMedia().then(s => {
            addDevices([new MediaStream([s.getVideoTracks()[0]]), "video"]);
        });
        return;
    }
    
    navigator.mediaDevices.enumerateDevices().then(device_list => {
        const mapping = {'cam': 'videoinput',
                         'mic': 'audioinput',
                         'spk': 'audiooutput'};
        devices = device_list.filter(x => x.kind == mapping[type]);
        deviceNameMapping = {}
        for(const device of devices) {
            deviceNameMapping[device.label] = device;
        }
        print(deviceNameMapping);
    });
}

function promptSelection(mapping, callback) {
    const base = document.createElement("div");
    base.className = "popupSelectorBase";
    const selector = document.createElement("select");
    selector.className = "popupSelector"
    base.appendChild(selector);
    for(const key of Object.keys(mapping)) {
        const choice = document.createElement("option");
        choice.setAttribute("value", choice);
        choice.innerHTML = key;
        selector.appendChild(choice);
    }
    selector.onchange = () => {
        callback(mapping[selector.value]);
    }
}