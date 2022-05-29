import websockets, asyncio, json
from uuid import uuid4
from string import ascii_letters, digits

clients = {}
rooms = {}

def make_id(charset=ascii_letters+digits):
    return ''.join(charset[i%len(charset)] for i in uuid4().bytes)

async def send(uuid, type_, dat):
    await clients[uuid]['connection'].send(json.dumps(dat | {'type': type_}))

async def handle_data(dat, uuid):
    match dat['type']:
        case 'join':
            if 'room' in clients[uuid]:
                return
            
            client = clients[uuid]
            
            if 'room' not in dat:
                await client['connection'].close()
                return
            
            room_name = dat['room']
            if room_name in rooms:
                rooms[room_name][uuid] = client
            else:
                rooms[room_name] = {uuid: client}
            client['room'] = room_name
            
            print(f'Room "{room_name}" + "{uuid}"')
            
            room = rooms[room_name]
            if len(room) == 1: return
            
            for peer in room:
                if peer == uuid: continue
                await send(peer, 'addPeer', {'peer_uuid': uuid, 'create_offer': False})
                await send(uuid, 'addPeer', {'peer_uuid': peer, 'create_offer': True })
        
        case 'relayICECandidate'|'relaySessionDescription'|'peerMessage' as choice:
            if (peer_uuid := dat['peer_uuid']) not in clients: return
            
            match choice:
                case 'relayICECandidate':
                    await send(peer_uuid, 'iceCandidate', {
                        'peer_uuid': uuid,
                        'ice_candidate': dat['ice_candidate']})
                
                case 'relaySessionDescription':
                    await send(peer_uuid, 'sessionDescription', {
                        'peer_uuid': uuid,
                        'session_description': dat['session_description']})
                
                case 'peerMessage':
                    await send(peer_uuid, 'peerMessage', {
                        'peer_uuid': uuid,
                        'message': dat['message']
                    })

async def server(websocket):
    clients[uuid := make_id()] = {'connection': websocket}
    try:
        async for data in websocket:
            try:
                dat = json.loads(data)
            except json.JSONDecodeError as err:
                print("Error decoding json", err)
                continue
            
            await handle_data(dat, uuid)
    except Exception as err:
        print(f"Closing {uuid}: {err}")
    finally:
        if 'room' in clients[uuid]:
            room_name = clients[uuid]['room']
            if room_name in rooms:
                room = rooms[room_name]
                
                if uuid in room:
                    del room[uuid]
                    print(f'Room "{room_name}" - "{uuid}"')
                
                if len(room) == 0:
                    del rooms[room_name]
                else:
                    for peer in room:
                        await send(peer, 'removePeer', { 'peer_uuid': uuid })
        del clients[uuid]

async def main():
    async with websockets.serve(server, "0.0.0.0", 4567):
        await asyncio.Future()

asyncio.run(main())