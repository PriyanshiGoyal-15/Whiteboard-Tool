import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { clearBoard, undo, redo, setElements, setBackgroundType } from './store/whiteboardSlice';
import { store } from './store/store';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';
import Lobby from './components/Lobby';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const [roomId, setRoomId] = useState(() => {
    return new URLSearchParams(window.location.search).get('room') || null;
  }); 
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('username') || null;
  });
  const [userColor, setUserColor] = useState(() => {
    return localStorage.getItem('userColor') || '#0078d4';
  });
  const [isJoined, setIsJoined] = useState(() => {
    const urlRoomId = new URLSearchParams(window.location.search).get('room');
    const storedUsername = localStorage.getItem('username');
    return Boolean(urlRoomId && storedUsername);
  });

  const canvasRef = useRef(null);
  const isInitializedRef = useRef(false);
  const dispatch = useDispatch();
  const elements = useSelector((state) => state.whiteboard.elements);
  const backgroundType = useSelector((state) => state.whiteboard.backgroundType);

  const handleJoin = ({ username, roomId, color }) => {
    setUsername(username);
    setRoomId(roomId);
    if (color) setUserColor(color);
    setIsJoined(true);
    
    const newUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  };

  useEffect(() => {
    if (!isJoined || !roomId) return;

    const newSocket = io(SERVER_URL, {
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionStatus('connected');
      if (!isInitializedRef.current) {
        newSocket.emit('join-room', roomId);
      }
    });

    newSocket.on('connect_error', () => {
      setConnectionStatus('disconnected');
    });

    newSocket.on('disconnect', (reason) => {
      setConnectionStatus('disconnected');
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
    });

    newSocket.on('reconnect', () => {
      setConnectionStatus('connected');
      newSocket.emit('join-room', roomId);
    });

    newSocket.on('init-state', (data) => {
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      if (data) {
        if (Array.isArray(data)) {
          dispatch(setElements(data));
        } else {
          if (Array.isArray(data.elements)) dispatch(setElements(data.elements));
          if (data.background) dispatch(setBackgroundType(data.background));
        }
      }
    });

    newSocket.on('sync-board', (data) => {
      if (data) {
        if (Array.isArray(data.elements)) dispatch(setElements(data.elements));
        if (data.background) dispatch(setBackgroundType(data.background));
      }
    });

    return () => newSocket.close();
  }, [roomId, dispatch, isJoined]);

  useEffect(() => {
    if (!isJoined || !socket || !isInitializedRef.current) return;
    const delay = setTimeout(() => {
      socket.emit('save-state', { roomId, elements, background: backgroundType });
    }, 1000);
    return () => clearTimeout(delay);
  }, [elements, backgroundType, socket, roomId, isJoined]);

  useEffect(() => {
    if (!isJoined) return;
    const handleBeforeUnload = () => {
      if (socket && isInitializedRef.current) {
        const state = store.getState();
        socket.emit('save-state', {
          roomId,
          elements: state.whiteboard.elements,
          background: state.whiteboard.backgroundType
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [socket, roomId, isJoined]);

  const handleUndo = () => {
    dispatch(undo());
    setTimeout(() => {
      const state = store.getState();
      if (socket) {
        socket.emit('sync-board', {
          roomId,
          elements: state.whiteboard.elements,
          background: state.whiteboard.backgroundType
        });
      }
    }, 0);
  };

  const handleRedo = () => {
    dispatch(redo());
    setTimeout(() => {
      const state = store.getState();
      if (socket) {
        socket.emit('sync-board', {
          roomId,
          elements: state.whiteboard.elements,
          background: state.whiteboard.backgroundType
        });
      }
    }, 0);
  };

  useEffect(() => {
    if (!isJoined) return;
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [socket, isJoined]);

  const handleExport = () => {
    if (canvasRef.current) {
      if (canvasRef.current.exportWithBg) {
        canvasRef.current.exportWithBg();
      } else {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'whiteboard-export.png';
        link.href = dataUrl;
        link.click();
      }
    }
  };

  const handleClear = () => {
    dispatch(clearBoard());
    if (socket) {
      socket.emit('clear', roomId);
    }
  };

  if (!isJoined) {
    return <Lobby onJoin={handleJoin} />;
  }

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-background">
      <TopBar
        roomId={roomId}
        onExport={handleExport}
        onClear={handleClear}
        onUndo={handleUndo}
        onRedo={handleRedo}
        connectionStatus={connectionStatus}
      />
      <Toolbar />
      <CanvasArea
        socket={socket}
        roomId={roomId}
        username={username}
        userColor={userColor}
        forwardRef={canvasRef}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}

export default App;
