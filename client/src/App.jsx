import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { clearBoard, undo, redo } from './store/whiteboardSlice';
import { store } from './store/store';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import CanvasArea from './components/CanvasArea';

const SERVER_URL = 'http://localhost:3001';

function App() {
  const [socket, setSocket] = useState(null);
  const roomId = 'global-board'; // Hardcoded for this prototype
  const canvasRef = useRef(null);
  const dispatch = useDispatch();
  const elements = useSelector((state) => state.whiteboard.elements);

  useEffect(() => {
    const newSocket = io(SERVER_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      newSocket.emit('join-room', roomId);
    });

    return () => newSocket.close();
  }, []);

  // Debounced MongoDB Save State
  useEffect(() => {
    if (!socket) return;
    const delay = setTimeout(() => {
      socket.emit('save-state', { roomId, elements });
    }, 1000); // Save after 1 second of inactivity
    return () => clearTimeout(delay);
  }, [elements, socket]);

  const handleUndo = () => {
    dispatch(undo());
    setTimeout(() => {
      const state = store.getState();
      if (socket) {
        socket.emit('sync-board', { roomId, elements: state.whiteboard.elements });
      }
    }, 0);
  };

  const handleRedo = () => {
    dispatch(redo());
    setTimeout(() => {
      const state = store.getState();
      if (socket) {
        socket.emit('sync-board', { roomId, elements: state.whiteboard.elements });
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
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'whiteboard-export.png';
      link.href = dataUrl;
      link.click();
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
