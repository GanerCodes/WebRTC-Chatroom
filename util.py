PORT = 2000
MLOC = "./message"

import json
from hashlib import sha256
from uuid import uuid4
from string import ascii_letters, digits

clients, rooms = {}, {}

def squish_bytes(data, charset=ascii_letters+digits):
    return ''.join(charset[i%len(charset)] for i in data)

def make_id(charset=ascii_letters+digits):
    return squish_bytes(uuid4().bytes, charset)

def squash(data):
    return squish_bytes(sha256(data.encode()).digest())[:64]

def get_client_room(uuid, add_client=True):
    client = clients[uuid]
    room_name = client['room']
    
    if room_name not in rooms:
        rooms[room_name] = { 'members': {} }
    
    if add_client:
        rooms[room_name]['members'][uuid] = client
    
    return room_name, rooms[room_name], rooms[room_name]['members']

async def send(to_uuid, type_, dat):
    await clients[to_uuid]['connection'].send(json.dumps(dat | {'type': type_}))