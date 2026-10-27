import asyncio
import json
from typing import Dict, List, Set
from fastapi import WebSocket
from app.core.logging import logger


class ConnectionManager:
    def __init__(self):
        # active connections
        self.active_connections: Set[WebSocket] = set()
        # topic subscriptions: topic -> set of WebSockets
        self.subscriptions: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        for topic, subs in self.subscriptions.items():
            subs.discard(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(self.active_connections)}")

    def subscribe(self, websocket: WebSocket, topic: str):
        if topic not in self.subscriptions:
            self.subscriptions[topic] = set()
        self.subscriptions[topic].add(websocket)

    def unsubscribe(self, websocket: WebSocket, topic: str):
        if topic in self.subscriptions:
            self.subscriptions[topic].discard(websocket)

    async def broadcast(self, message: dict, topic: str = "all"):
        payload = json.dumps(message)
        targets: Set[WebSocket] = set()
        
        if topic == "all":
            targets = set(self.active_connections)
        elif topic in self.subscriptions:
            targets = set(self.subscriptions[topic])
            
        disconnected = set()
        for connection in targets:
            try:
                await connection.send_text(payload)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.add(connection)
                
        for dead_conn in disconnected:
            self.disconnect(dead_conn)


ws_manager = ConnectionManager()
