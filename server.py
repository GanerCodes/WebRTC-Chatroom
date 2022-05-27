import websockets, asyncio, json
from uuid import uuid4
from string import ascii_letters, digits

clients = {}

def make_id(charset=ascii_letters+digits):
    return ''.join(charset[i%len(charset)] for i in uuid4().bytes)

async def send(uuid, type_, dat):
    await clients[uuid]['connection'].send(json.dumps(dat | {'type': type_}))

async def handle_data(dat, uuid):
    match dat['type']:
        case 'join':
            for peer in clients:
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
    log = lambda x, c=False, uuid=uuid: print(f"{uuid}: {x}{f'| Total client count: {len(clients)}' if c else ''}")
    log("+ Client", True)
    try:
        async for data in websocket:
            try:
                dat = json.loads(data)
            except json.JSONDecodeError as err:
                print("Error decoding json", err)
                continue
            
            await handle_data(dat, uuid)
    except Exception as err:
        log(f"Error: `{err}`")
    finally:
        del clients[uuid]
        log(f"- Client", True)
        for client in clients:
            await send(client, 'removePeer', { 'peer_uuid': uuid })

async def main():
    async with websockets.serve(server, "0.0.0.0", 4567):
        await asyncio.Future()

asyncio.run(main())