from util import *
import websockets, asyncio, json
import messaging

async def handle_data(dat, uuid):
    match dat['type']:
        case 'join':
            if 'room' in clients[uuid]: return
            if 'room' not in dat:
                await client['connection'].close()
                return
            
            client = clients[uuid]
            client['room'] = squash(dat['room'])
            room_name, room, members = get_client_room(uuid)
            
            print(f'Room "{room_name}" + "{uuid}"')
            
            if len(members) == 1: return
            
            for peer in members:
                if peer == uuid: continue
                await send(peer, 'addPeer', {'peer_uuid': uuid, 'create_offer': False})
                await send(uuid, 'addPeer', {'peer_uuid': peer, 'create_offer': True })
        
        case 'relayICECandidate'|'relaySessionDescription'|'peerMessage' as choice:
            if (peer_uuid := dat['peer_uuid']) not in clients:
                return
            
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
                    await messaging.send_peer_message(uuid, peer_uuid, dat['message'])
        
        case 'getMessages':
            await messaging.send_peer_message("server", uuid, {
                "type": "chatMessages",
                "messages": messaging.get_n_messages(clients[uuid]['room'], limit=250)
            })
        
        case 'chatMessage':
            await messaging.send_chat_message(uuid, dat['message'])

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
        raise err
    finally:
        if 'room' in clients[uuid]:
            room_name, room, _ = get_client_room(uuid, add_client=False)
            
            if uuid in room['members']:
                del room['members'][uuid]
            print(f'Room "{room_name}" - "{uuid}"')
            
            if len(room['members']) == 0:
                del rooms[room_name]
            else:
                for peer in room['members']:
                    await send(peer, 'removePeer', { 'peer_uuid': uuid })
        del clients[uuid]

async def main():
    async with websockets.serve(server, "127.0.0.1", PORT):
        await asyncio.Future()

asyncio.run(main())
