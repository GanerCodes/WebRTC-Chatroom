from util import *
import os, time, itertools

room_file = lambda r: f"{MLOC}/{r}"

def create_message(uuid, message):
    return { "user": uuid, "time": time.time_ns(), "message": message }

def aquire_room_messaging(room_id):
    room = rooms[room_id]
    
    if 'messages' in room:
        return room, room['messages']
    
    if room_id in os.listdir(MLOC):
        roomf = room_file(room_id)
        try:
            with open(roomf, 'r') as f:
                messages = json.load(f)
        except json.decoder.JSONDecodeError:
            os.remove(roomf)
            messages = []
    else:
        messages = []
    
    room['messages'] = messages
    return room, messages

def write_room_message(room_id, uuid, message):
    room, messages = aquire_room_messaging(room_id)
    new_message = create_message(uuid, message)
    messages.append(new_message)
    with open(room_file(room_id), 'w') as f:
        json.dump(messages, f)
    return new_message

def get_n_messages(room_id, limit=500):
    room, messages = aquire_room_messaging(room_id)
    return messages[-limit:]

def get_messages_since_timestamp(room_id, timestamp, limit=500):
    room, messages = aquire_room_messaging(room_id)
    return list(
        itertools.islice(
            (m for m in messages if m['time'] > timestamp),
            -limit))

async def send_peer_message(from_uuid, to_uuid, message):
    await send(to_uuid, 'peerMessage', {
        'peer_uuid': from_uuid,
        'message': message
    })

async def broadcast_message(uuid, room_id, message, ignore_self_uuid=False):
    for peer in rooms[room_id]['members']:
        if ignore_self_uuid and peer == uuid:
            continue
        await send_peer_message(uuid, peer, message)

async def send_chat_message(uuid, message):
    room_id = clients[uuid]['room']
    new_message = write_room_message(room_id, uuid, message)
    await broadcast_message(uuid, room_id, {
        "type": "chatMessages",
        "messages": [new_message]
    })