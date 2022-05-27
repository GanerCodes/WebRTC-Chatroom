function createTrackContainer(uuid) {
    const elm = document.createElement("div");
    
    elm.setAttribute("id", uuid);
    elm.className = "trackContainer";
    return elm;
}

function createTrackElement(track, id) {
    const elm = document.createElement("video");
    elm.setAttribute("autoplay", true);
    elm.muted = true;
    elm.srcObject = new MediaStream([track]);
    
    elm.setAttribute("id", id)
    elm.className = "track";
    return elm;
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
        container.appendChild(createTrackElement(track, id))
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