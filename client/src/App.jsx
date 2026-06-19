import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { clearBoard, undo, redo, setElements, setBackgroundType } from './store/whiteboardSlice';
import { store } from './store/store';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';

const SERVER_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const [roomId] = useState(() => {
    const storedRoomId = localStorage.getItem("roomId");
    if (storedRoomId) return storedRoomId;
    const newRoomId = crypto.randomUUID();
    localStorage.setItem("roomId", newRoomId);
    return newRoomId;
  });
  const canvasRef = useRef(null);
  const dispatch = useDispatch();
  const elements = useSelector((state) => state.whiteboard.elements);
  const backgroundType = useSelector((state) => state.whiteboard.backgroundType);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-room', roomId);
    });

    newSocket.on('init-state', (data) => {
      console.log('[App] init-state received:', data);
      if (data) {
        if (Array.isArray(data)) {
          dispatch(setElements(data));
        } else {
          if (data.elements) dispatch(setElements(data.elements));
          if (data.background) dispatch(setBackgroundType(data.background));
        }
      }
    });

    return () => newSocket.close();
  }, [roomId, dispatch]);

  // Debounced MongoDB Save State
  useEffect(() => {
    if (!socket) return;
    const delay = setTimeout(() => {
      socket.emit('save-state', { roomId, elements, background: backgroundType });
    }, 1000); // Save after 1 second of inactivity
    return () => clearTimeout(delay);
  }, [elements, backgroundType, socket, roomId]);

  // Browser Refresh Protection
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket) {
        socket.emit('save-state', { roomId, elements, background: backgroundType });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [socket, elements, backgroundType, roomId]);

  const handleUndo = () => {
    dispatch(undo());
    setTimeout(() => {
      const state = store.getState();
      if (socket) {
        socket.emit('sync-board', { roomId, elements: state.whiteboard.elements, background: state.whiteboard.backgroundType });
      }
    }, 0);
  };

  const handleRedo = () => {
    dispatch(redo());
    setTimeout(() => {
      const state = store.getState();
      if (socket) {
        socket.emit('sync-board', { roomId, elements: state.whiteboard.elements, background: state.whiteboard.backgroundType });
      }
    }, 0);
  };

  // Keyboard shortcuts for Undo and Redo
  useEffect(() => {
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
  }, [socket]);

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

  return (
    <div className="relative w-full h-screen overflow-hidden bg-background">
      <TopBar 
        onExport={handleExport} 
        onClear={handleClear} 
        onUndo={handleUndo} 
        onRedo={handleRedo} 
      />
      <Toolbar />
      <CanvasArea 
        socket={socket} 
        roomId={roomId} 
        forwardRef={canvasRef}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />
    </div>
  );
}

export default App;
