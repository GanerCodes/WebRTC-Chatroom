function chatboxKeypress(event, elm) {
    if(event.code == "Enter") {
        let msg = elm.value;
        if(msg.length > 0) {
            elm.value = "";
            send_chat_message(msg);
        }
    }
}

function handleChatMessage(message) {
    if(!message['messages'].length) return;
    
    chat.push(...message['messages']);
    chat.sort((a, b) => a['time'] > b['time']);
    const container = document.getElementById("chatTextArea");
    let elm;
    for(msg of message['messages']) {
        elm = document.createElement("div");
        elm.className = "chatMessage";
        elm.appendChild(document.createTextNode(`${msg['user']} > ${msg['message']}`));
        container.appendChild(elm);
    }
    elm.scrollIntoView();
};