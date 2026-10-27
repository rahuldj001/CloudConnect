import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';

interface WebSocketContextType {
  isConnected: boolean;
  subscribe: (topic: string, callback: (data: any) => void) => () => void;
  lastMessage: any;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws`;

    let reconnectTimer: any = null;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          // Re-subscribe to all active topics
          listenersRef.current.forEach((_, topic) => {
            ws.send(JSON.stringify({ action: 'subscribe', topic }));
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setLastMessage(data);

            // Notify topic listeners
            const topic = data.topic || 'all';
            const topicListeners = listenersRef.current.get(topic);
            if (topicListeners) {
              topicListeners.forEach((callback) => callback(data));
            }
            const allListeners = listenersRef.current.get('all');
            if (allListeners) {
              allListeners.forEach((callback) => callback(data));
            }
          } catch {
            // non-json message
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Try reconnect after 3s
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          setIsConnected(false);
          ws.close();
        };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, [isAuthenticated]);

  const subscribe = (topic: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(topic)) {
      listenersRef.current.set(topic, new Set());
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: 'subscribe', topic }));
      }
    }
    listenersRef.current.get(topic)?.add(callback);

    // Unsubscribe cleanup function
    return () => {
      const topicListeners = listenersRef.current.get(topic);
      if (topicListeners) {
        topicListeners.delete(callback);
        if (topicListeners.size === 0) {
          listenersRef.current.delete(topic);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'unsubscribe', topic }));
          }
        }
      }
    };
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, subscribe, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
