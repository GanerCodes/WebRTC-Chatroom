const SELF_SIZE = 128;
const OTHER_SIZE = 512;

function createTrackContainer(uuid) {
    const elm = document.createElement("div");
    
    elm.setAttribute("id", uuid);
    elm.className = "trackContainer";
    return elm;
}

function boxTrackElement(element, size) {
    let elm = document.createElement("div");
    elm.className = "trackBox";
    const sz = size + "px";
    elm.appendChild(element);
    elm.style['width' ] = sz;
    elm.style['height'] = sz;
    return elm;
}

function createTrackElement(track, id, type) {
    let elm;
    if(type == "video") {
        elm = document.createElement("video");
        elm.className = "track";
        elm.muted = true;
    }else{
        elm = document.createElement("audio");
        elm.className = "track audioTrack";
        elm.muted = false;
        elm.controls = true;
    }
    
    elm.setAttribute("autoplay", true);
    elm.srcObject = new MediaStream([track]);
    
    elm = boxTrackElement(elm, OTHER_SIZE);
    elm.setAttribute("id", id);
    return elm;
}

function addSelfPreview(trackID, type) {
    const selfContainer = document.getElementById("selfContainer");
    const device = self['tracks'][trackID];
    const elm = document.createElement("video");
    
    elm.setAttribute("autoplay", true);
    elm.muted = true;
    
    elm.srcObject = device;
    elm.setAttribute("id", trackID)
    elm.className = "selfTrack";
    
    selfContainer.appendChild(boxTrackElement(elm, SELF_SIZE));
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
    
    const currentTrackElements = container.getElementsByClassName("trackBox");
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
        
        deviceNameMapping = {}
        device_list.filter(x => x.kind == mapping[type]).forEach(d => deviceNameMapping[d.label] = d);
        
        let func;
        switch(type) {
            case "cam": {
                func = (l) => {
                    print(l);
                    navigator.mediaDevices.getUserMedia({"video": true, label: l}).then(stream => {
                        addDevices([new MediaStream([stream.getVideoTracks()[0]]), "video"]);
                    });
                }
            } break;
            case "mic": {
                func = (l) => {
                    navigator.mediaDevices.getUserMedia({"audio": true, label: l}).then(stream => {
                        addDevices([new MediaStream([stream.getAudioTracks()[0]]), "audio"]);
                    })
                }
            } break;
        }
        promptSelection(deviceNameMapping, func);
    });
}

function promptSelection(mapping, callback) {
    const base = document.createElement("div");
    base.className = "popupSelectorBase";
    const selector = document.createElement("select");
    selector.className = "popupSelector"
    base.appendChild(selector);
    
    const def = document.createElement("option");
    def.innerHTML = "Select...";
    def.hidden = true;
    def.disabled = true;
    def.selected = true;
    selector.appendChild(def);
    
    for(const key of Object.keys(mapping)) {
        const choice = document.createElement("option");
        choice.setAttribute("value", choice);
        choice.innerHTML = key;
        selector.appendChild(choice);
    }
    base.onclick = () => {
        base.remove();
    }
    selector.onchange = () => {
        callback(mapping[selector.value]);
        base.remove();
    };
    document.body.appendChild(base);
}