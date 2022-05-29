const SELF_SIZE = [128, 128];

const OTHER_SIZE_VIDEO = [512, 512];
const OTHER_SIZE_AUDIO = [128, 512];

function createTrackContainer(uuid) {
    const elm = document.createElement("div");
    
    elm.setAttribute("id", uuid);
    elm.className = "trackContainer";
    return elm;
}

function boxTrackElement(element, size) {
    let elm = document.createElement("div");
    elm.className = "trackBox";
    elm.appendChild(element);
    elm.style['width' ] = size[0];
    elm.style['height'] = size[1];
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
        elm.className = "audioTrack";
        elm.muted = false;
        elm.controls = true;
    }
    
    elm.setAttribute("autoplay", true);
    elm.srcObject = new MediaStream([track]);
    
    const boxed_elm = boxTrackElement(elm, type == "audio" ? OTHER_SIZE_AUDIO : OTHER_SIZE_VIDEO);
    boxed_elm.setAttribute("id", id);
    
    if(type == "audio") {
        const slider = document.createElement("input");
        slider.type = "range";
        slider.className = "peer_volume_range";
        slider.setAttribute("orient", "vertical");
        slider.min = 0;
        slider.max = 100;
        slider.value = 50;
        slider.onchange = () => elm.volume = slider.value / slider.max;
        
        const peerAudioOptionSpan = document.createElement("span");
        peerAudioOptionSpan.className = "peerAudioOptionSpan";
        
        const mutedText = document.createElement("text");
        mutedText.className = "mutedText";
        mutedText.innerHTML = "Mute";
        
        const check = document.createElement("input");
        check.className = "peer_mute_checkbox";
        check.type = "checkbox";
        check.checked = elm.paused;
        check.onchange = () => check.checked ? elm.pause() : elm.play();
        
        peerAudioOptionSpan.appendChild(mutedText);
        peerAudioOptionSpan.appendChild(check);
        
        boxed_elm.appendChild(peerAudioOptionSpan);
        boxed_elm.appendChild(slider);
    }else{
        boxed_elm.oncontextmenu = (e) => {
            e.preventDefault();
            boxed_elm.oncontextmenusave = boxed_elm.oncontextmenu;
            boxed_elm.oncontextmenu = () => 0;
            const g = (x) => Number(x.replace(/px/, ""))
            const sty = boxed_elm.style;
            const startEvent = e;
            const startSize = [g(sty.width), g(sty.height)]
            window.onmousemove = (e) => {
                e.preventDefault();
                sty.width  = Math.max(42, startSize[0] + (e.clientX - startEvent.clientX)) + "px";
                sty.height = Math.max(42, startSize[1] + (e.clientY - startEvent.clientY)) + "px";
            };
            setTimeout(() => {
                window.oncontextmenu = (e) => {
                    e.preventDefault();
                    window.onmousemove = () => 0;
                    window.oncontextmenu = () => 0;
                    boxed_elm.oncontextmenu = boxed_elm.oncontextmenusave;
                }
            }, 10);
            // sty['width'] = 2 * g(sty['width']) + "px";
            // sty['height'] = 2 * g(sty['height']) + "px";
        }
    }
    
    return boxed_elm;
}

function addSelfPreview(trackID, type) {
    const selfContainer = document.getElementById("selfContainer");
    const device = self['tracks'][trackID];
    let elm;
    if(type == "audio") {
        elm = document.createElement("div");
        elm.className = "selfAudioTrack";
        
        const e = document.createElement("text");
        e.className = "micLabel";
        if(device['name']) e.innerHTML = device['name'];
        elm.appendChild(e);
    }else{
        elm = document.createElement("video");
        elm.className = "selfTrack";
    }
    
    elm.setAttribute("autoplay", true);
    elm.muted = true;
    elm.srcObject = device;
    
    const box = boxTrackElement(elm, SELF_SIZE);
    box.setAttribute("id", trackID)
    
    const dev = [...device.getVideoTracks(), ...device.getAudioTracks()][0];
    dev.onended = () => {
        box.remove();
        delete self['tracks'][trackID];
        delete self['layout'][trackID];
        broadcastRemoveTrack(trackID);
        broadcastLayout();
    };
    
    box.onclick = () => {
        dev.stop();
        dev.onended();
    };
    
    selfContainer.appendChild(box);
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
        if(elm.id != '' && !(elm.id in peer_tracks)) elm.remove();
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

function addSourcePrompt(type, event) {
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
                    navigator.mediaDevices.getUserMedia({"video": true, label: l}).then(stream => {
                        addDevices([new MediaStream([stream.getVideoTracks()[0]]), "video"]);
                    });
                }
            } break;
            case "mic": {
                func = (l) => {
                    navigator.mediaDevices.getUserMedia({"audio": true, label: l}).then(stream => {
                        addDevices([new MediaStream([stream.getAudioTracks()[0]]), "audio", l.label]);
                    })
                }
            } break;
            case "spk": {
                // TODO choose specific output depending on person
                // also, add the ability to listen to your own mic
                func = (l) => {
                    const audio = document.querySelector('audio');
                    if(audio) {
                        audio.setSinkId(l.deviceId);
                    }
                }
            }
        }
        floating_menu(type, event, Object.entries(deviceNameMapping).map(([k, v]) => (
            {'type': 'button',
             'label': k,
             'exit': true,
             'func': () => func(v)})));
    });
}

function updateUserListText() {
    document.getElementById("userListText").innerHTML = "Users: " + ["You"].concat(Object.keys(peers)).join(", ");
}