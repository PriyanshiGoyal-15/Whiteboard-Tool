import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addElement, setElements, clearBoard, updateElement, setPanOffset, setActiveTool, deleteElement, duplicateElement, saveHistoryState } from '../store/whiteboardSlice';
import { v4 as uuidv4 } from 'uuid';
import { Copy, Trash2 } from 'lucide-react';

const distanceToLineSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

const CanvasArea = ({ socket, roomId, forwardRef, onUndo, onRedo }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const dispatch = useDispatch();
  
  const { elements, activeTool, color, strokeWidth, panOffset } = useSelector((state) => state.whiteboard);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState(null);
  
  // Selection and drag states
  const currentPathRef = useRef([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hoveredHandle, setHoveredHandle] = useState(null);

  // Marquee Selection states
  const [isDrawingMarquee, setIsDrawingMarquee] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState({ x: 0, y: 0 });

  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStartPositions = useRef({});
  const initialResizeState = useRef(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);

  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, id: null, isSticky: false, isEditingExisting: false, text: '' });
  const inputRef = useRef(null);
  const isCommittingRef = useRef(false);

  // Other users' cursors
  const [cursors, setCursors] = useState({});

  // Focus the input/textarea when it becomes visible or when it changes to a new element
  useEffect(() => {
    if (textInput.visible && inputRef.current) {
      inputRef.current.focus();
    }
  }, [textInput.visible, textInput.id]);

  // Spawn sticky note or text box instantly on toolbar selection
  useEffect(() => {
    if (activeTool === 'sticky') {
      const centerX = (window.innerWidth / 2 - panOffset.x - 75) / zoom;
      const centerY = (window.innerHeight / 2 - panOffset.y - 75) / zoom;
      
      const newStickyElement = {
        id: uuidv4(),
        tool: 'sticky',
        color: '#fef08a', // Default yellow sticky
        strokeWidth: 3,
        startX: centerX,
        startY: centerY,
        width: 150,
        height: 150,
        text: ''
      };
      
      dispatch(addElement(newStickyElement));
      if (socket && roomId) {
        socket.emit('draw', { roomId, element: newStickyElement });
      }
      
      setSelectedIds([newStickyElement.id]);
      dispatch(setActiveTool('select'));
      
    } else if (activeTool === 'text') {
      if (!textInput.visible) {
        const centerX = (window.innerWidth / 2 - panOffset.x - 125) / zoom;
        const centerY = (window.innerHeight / 2 - panOffset.y - 10) / zoom;
        
        setTextInput({
          visible: true,
          x: centerX,
          y: centerY,
          id: uuidv4(),
          isSticky: false,
          isEditingExisting: false,
          text: ''
        });
      }
    }
  }, [activeTool]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const context = canvas.getContext('2d');
    contextRef.current = context;
    
    if (forwardRef) {
      forwardRef.current = canvas;
    }
  }, [forwardRef]);

  // Add Wheel event listener for zooming and panning
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const handleWheel = (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      let newZoom = zoom;
      
      if (e.ctrlKey || e.metaKey) {
        // Zooming
        if (e.deltaY < 0) {
          newZoom = Math.min(zoom * zoomFactor, 5); // max zoom 5x
        } else {
          newZoom = Math.max(zoom / zoomFactor, 0.2); // min zoom 0.2x
        }
      } else {
        // Panning with wheel scroll
        dispatch(setPanOffset({
          x: panOffset.x - e.deltaX,
          y: panOffset.y - e.deltaY
        }));
        return;
      }
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - panOffset.x) / zoom;
      const worldY = (mouseY - panOffset.y) / zoom;
      
      const newPanOffset = {
        x: mouseX - worldX * newZoom,
        y: mouseY - worldY * newZoom
      };
      
      setZoom(newZoom);
      dispatch(setPanOffset(newPanOffset));
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom, panOffset, dispatch]);


  const getWorldCoordinates = (clientX, clientY) => {
    return {
      x: (clientX - panOffset.x) / zoom,
      y: (clientY - panOffset.y) / zoom
    };
  };

  const getTextWidth = (text, strokeWidth) => {
    const ctx = contextRef.current;
    if (!ctx) return 150;
    ctx.save();
    ctx.font = `${strokeWidth * 4 + 12}px 'Segoe UI', Inter, sans-serif`;
    const w = ctx.measureText(text || '').width;
    ctx.restore();
    return Math.max(25, w);
  };

  const getElementBounds = (el) => {
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    if (el.tool === 'pen' || el.tool === 'highlighter' || el.tool === 'eraser') {
      if (el.points && el.points.length > 0) {
        minX = Math.min(...el.points.map(p => p.x));
        maxX = Math.max(...el.points.map(p => p.x));
        minY = Math.min(...el.points.map(p => p.y));
        maxY = Math.max(...el.points.map(p => p.y));
      }
    } else if (el.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(el.width, 2) + Math.pow(el.height, 2));
      minX = el.startX - radius;
      maxX = el.startX + radius;
      minY = el.startY - radius;
      maxY = el.startY + radius;
    } else if (el.tool === 'line' || el.tool === 'arrow') {
      minX = Math.min(el.startX, el.startX + el.width);
      maxX = Math.max(el.startX, el.startX + el.width);
      minY = Math.min(el.startY, el.startY + el.height);
      maxY = Math.max(el.startY, el.startY + el.height);
    } else if (el.tool === 'text') {
      const fontSize = el.strokeWidth * 4 + 12;
      const textWidth = getTextWidth(el.text, el.strokeWidth);
      minX = el.startX;
      maxX = el.startX + textWidth;
      minY = el.startY - fontSize;
      maxY = el.startY;
    } else {
      // rect, sticky
      minX = Math.min(el.startX, el.startX + el.width);
      maxX = Math.max(el.startX, el.startX + el.width);
      minY = Math.min(el.startY, el.startY + el.height);
      maxY = Math.max(el.startY, el.startY + el.height);
    }
    
    return { minX, maxX, minY, maxY };
  };

  const isPointInElement = (el, x, y) => {
    const bounds = getElementBounds(el);
    
    if (el.tool === 'rect' || el.tool === 'sticky') {
      return x >= bounds.minX && x <= bounds.maxX &&
             y >= bounds.minY && y <= bounds.maxY;
    } else if (el.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(el.width, 2) + Math.pow(el.height, 2));
      const dist = Math.hypot(x - el.startX, y - el.startY);
      return dist <= radius + 5;
    } else if (el.tool === 'text') {
      return x >= bounds.minX && x <= bounds.maxX &&
             y >= bounds.minY && y <= bounds.maxY;
    } else if (el.tool === 'line' || el.tool === 'arrow') {
      return distanceToLineSegment(x, y, el.startX, el.startY, el.startX + el.width, el.startY + el.height) < 8;
    } else if (el.tool === 'pen' || el.tool === 'highlighter' || el.tool === 'eraser') {
      if (!el.points) return false;
      for (let i = 0; i < el.points.length - 1; i++) {
        const p1 = el.points[i];
        const p2 = el.points[i + 1];
        if (distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y) < 8) {
          return true;
        }
      }
      return false;
    }
    return false;
  };

  const isPointInSelectionBounds = (x, y, ids) => {
    if (ids.length === 0) return false;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ids.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const bounds = getElementBounds(el);
        if (bounds.minX < minX) minX = bounds.minX;
        if (bounds.maxX > maxX) maxX = bounds.maxX;
        if (bounds.minY < minY) minY = bounds.minY;
        if (bounds.maxY > maxY) maxY = bounds.maxY;
      }
    });
    if (minX === Infinity) return false;
    // Bounding box with 5px padding
    return x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5;
  };

  // Redraw logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    
    // Clear canvas completely
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    context.save();
    context.translate(panOffset.x, panOffset.y);
    context.scale(zoom, zoom);

    // Draw all confirmed elements
    elements.forEach(el => drawElement(context, el));
    
    // Draw shape preview
    if (currentElement && activeTool !== 'pen' && activeTool !== 'highlighter' && activeTool !== 'eraser' && activeTool !== 'select' && activeTool !== 'pan') {
      drawElement(context, currentElement);
    }

    // Draw active pen/highlighter path
    if (isDrawing && (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') && currentPathRef.current.length > 0) {
      const activePenElement = {
        tool: activeTool,
        color: activeTool === 'eraser' ? '#f3f2f1' : color,
        strokeWidth,
        points: currentPathRef.current
      };
      drawElement(context, activePenElement);
    }

    // Draw marquee select box
    if (isDrawingMarquee) {
      context.strokeStyle = '#0078d4';
      context.lineWidth = 1 / zoom;
      context.fillStyle = 'rgba(0, 120, 212, 0.08)';
      context.beginPath();
      context.rect(
        marqueeStart.x,
        marqueeStart.y,
        marqueeEnd.x - marqueeStart.x,
        marqueeEnd.y - marqueeStart.y
      );
      context.fill();
      context.stroke();
    }
    
    // Draw selection outlines
    if (selectedIds.length > 0 && activeTool === 'select') {
      const selectedElements = elements.filter(el => selectedIds.includes(el.id));
      drawSelectionBox(context, selectedElements);
    }
    
    context.restore();
  }, [elements, currentElement, activeTool, selectedIds, isDrawing, color, strokeWidth, panOffset, zoom, isDrawingMarquee, marqueeStart, marqueeEnd]);

  const drawSelectionBox = (ctx, selectedElements) => {
    if (selectedElements.length === 0) return;
    
    ctx.strokeStyle = '#0078d4';
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    
    if (selectedElements.length === 1) {
      const el = selectedElements[0];
      const bounds = getElementBounds(el);
      ctx.beginPath();
      ctx.rect(bounds.minX - 5, bounds.minY - 5, (bounds.maxX - bounds.minX) + 10, (bounds.maxY - bounds.minY) + 10);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw corner resize handles
      if (el.tool === 'rect' || el.tool === 'sticky' || el.tool === 'circle' || el.tool === 'text') {
        const size = 8 / zoom;
        const half = size / 2;
        const corners = [
          { x: bounds.minX - 5, y: bounds.minY - 5 }, // TL
          { x: bounds.maxX + 5, y: bounds.minY - 5 }, // TR
          { x: bounds.minX - 5, y: bounds.maxY + 5 }, // BL
          { x: bounds.maxX + 5, y: bounds.maxY + 5 }  // BR
        ];
        
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 1.5 / zoom;
        
        corners.forEach(corner => {
          ctx.beginPath();
          ctx.rect(corner.x - half, corner.y - half, size, size);
          ctx.fill();
          ctx.stroke();
        });
      }
    } else {
      let overallMinX = Infinity;
      let overallMaxX = -Infinity;
      let overallMinY = Infinity;
      let overallMaxY = -Infinity;
      
      selectedElements.forEach(el => {
        const bounds = getElementBounds(el);
        if (bounds.minX < overallMinX) overallMinX = bounds.minX;
        if (bounds.maxX > overallMaxX) overallMaxX = bounds.maxX;
        if (bounds.minY < overallMinY) overallMinY = bounds.minY;
        if (bounds.maxY > overallMaxY) overallMaxY = bounds.maxY;
      });
      
      ctx.beginPath();
      ctx.rect(overallMinX - 8, overallMinY - 8, (overallMaxX - overallMinX) + 16, (overallMaxY - overallMinY) + 16);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  const drawStickyText = (ctx, text, startX, startY, width, height) => {
    ctx.fillStyle = (text && text.trim() !== '') ? '#323130' : '#8a8886';
    ctx.font = `16px 'Segoe UI', Inter, sans-serif`;
    
    const content = (text && text.trim() !== '') ? text : "Double-click to edit";
    const words = content.split(' ');
    let lines = [];
    let currentLine = '';
    const maxWidth = width - 20;
    
    for (let i = 0; i < words.length; i++) {
      let word = words[i];
      const wordWidth = ctx.measureText(word).width;
      
      if (wordWidth > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        
        let remainingWord = word;
        while (remainingWord.length > 0) {
          let testWord = '';
          let j = 0;
          while (j < remainingWord.length && ctx.measureText(testWord + remainingWord[j]).width <= maxWidth) {
            testWord += remainingWord[j];
            j++;
          }
          if (testWord === '') {
            testWord = remainingWord[0];
            j = 1;
          }
          lines.push(testWord);
          remainingWord = remainingWord.slice(j);
        }
      } else {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testLineWidth = ctx.measureText(testLine).width;
        if (testLineWidth > maxWidth) {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    const lineHeight = 20;
    let y = startY + 24;
    for (let i = 0; i < lines.length; i++) {
      if (y + lineHeight > startY + height) {
        break;
      }
      ctx.fillText(lines[i], startX + 10, y);
      y += lineHeight;
    }
  };

  const drawElement = (ctx, element) => {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.globalAlpha = element.tool === 'highlighter' ? 0.4 : 1.0;

    if (element.tool === 'pen' || element.tool === 'highlighter' || element.tool === 'eraser') {
      ctx.beginPath();
      const points = element.points;
      if (points && points.length > 0) {
        if (points.length === 1) {
          ctx.arc(points[0].x, points[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (points.length === 2) {
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
          ctx.stroke();
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
          ctx.stroke();
        }
      }
    } else if (element.tool === 'rect') {
      ctx.beginPath();
      ctx.rect(element.startX, element.startY, element.width, element.height);
      ctx.stroke();
    } else if (element.tool === 'sticky') {
      ctx.fillStyle = element.color;
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.fillRect(element.startX, element.startY, element.width, element.height);
      ctx.shadowColor = 'transparent';
      
      drawStickyText(ctx, element.text, element.startX, element.startY, element.width, element.height);
      
    } else if (element.tool === 'circle') {
      ctx.beginPath();
      const radius = Math.sqrt(Math.pow(element.width, 2) + Math.pow(element.height, 2));
      ctx.arc(element.startX, element.startY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (element.tool === 'line' || element.tool === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(element.startX, element.startY);
      const endX = element.startX + element.width;
      const endY = element.startY + element.height;
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      if (element.tool === 'arrow') {
        const angle = Math.atan2(endY - element.startY, endX - element.startX);
        const arrowLength = Math.max(12, element.strokeWidth * 3);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - arrowLength * Math.cos(angle - Math.PI / 6),
          endY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - arrowLength * Math.cos(angle + Math.PI / 6),
          endY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = element.color;
        ctx.fill();
      }
    } else if (element.tool === 'text') {
      ctx.font = `${element.strokeWidth * 4 + 12}px 'Segoe UI', Inter, sans-serif`;
      ctx.fillText(element.text || '', element.startX, element.startY);
    }
    
    ctx.globalAlpha = 1.0;
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('draw', (element) => dispatch(addElement(element)));
    socket.on('update-element', (payload) => dispatch(updateElement(payload)));
    socket.on('delete-element', (id) => dispatch(deleteElement(id)));
    socket.on('clear', () => dispatch(clearBoard()));
    socket.on('init-state', (initState) => dispatch(setElements(initState)));
    
    socket.on('cursor-move', (data) => {
      setCursors(prev => ({ ...prev, [data.socketId]: data }));
    });

    return () => {
      socket.off('draw');
      socket.off('update-element');
      socket.off('delete-element');
      socket.off('clear');
      socket.off('init-state');
      socket.off('cursor-move');
    };
  }, [socket, dispatch]);

  const getSelectionScreenBounds = (ids) => {
    if (ids.length === 0) return null;
    
    let overallMinX = Infinity;
    let overallMaxX = -Infinity;
    let overallMinY = Infinity;
    let overallMaxY = -Infinity;
    
    ids.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const bounds = getElementBounds(el);
        if (bounds.minX < overallMinX) overallMinX = bounds.minX;
        if (bounds.maxX > overallMaxX) overallMaxX = bounds.maxX;
        if (bounds.minY < overallMinY) overallMinY = bounds.minY;
        if (bounds.maxY > overallMaxY) overallMaxY = bounds.maxY;
      }
    });
    
    if (overallMinX === Infinity) return null;
    
    return {
      left: overallMinX * zoom + panOffset.x,
      top: overallMinY * zoom + panOffset.y,
      width: (overallMaxX - overallMinX) * zoom,
      height: (overallMaxY - overallMinY) * zoom
    };
  };

  const handleDuplicate = (ids) => {
    dispatch(saveHistoryState());
    const newIds = [];
    ids.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        const newId = uuidv4();
        newIds.push(newId);
        
        const duplicated = {
          ...el,
          id: newId,
          startX: el.startX !== undefined ? el.startX + 20 : undefined,
          startY: el.startY !== undefined ? el.startY + 20 : undefined,
          points: el.points ? el.points.map(p => ({ x: p.x + 20, y: p.y + 20 })) : undefined
        };
        
        dispatch(addElement(duplicated));
        if (socket && roomId) {
          socket.emit('draw', { roomId, element: duplicated });
        }
      }
    });
    setSelectedIds(newIds);
  };

  const handleDelete = (ids) => {
    dispatch(saveHistoryState());
    ids.forEach(id => {
      dispatch(deleteElement(id));
      if (socket && roomId) {
        socket.emit('delete-element', { roomId, id });
      }
    });
    setSelectedIds([]);
  };

  const handleColorChange = (ids, newColor) => {
    dispatch(saveHistoryState());
    ids.forEach(id => {
      dispatch(updateElement({ id, updates: { color: newColor } }));
      if (socket && roomId) {
        socket.emit('update-element', { roomId, id, updates: { color: newColor } });
      }
    });
  };

  // Keyboard shortcuts for selected element
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if (activeTool === 'select' && selectedIds.length > 0) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDelete(selectedIds);
        } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          handleDuplicate(selectedIds);
        }
      }
      
      if (activeTool === 'select') {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          setSelectedIds(elements.map(el => el.id));
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, selectedIds, elements]);

  const handleResizeMove = (worldCoords) => {
    if (!initialResizeState.current) return;
    
    const { element: initialEl, handle, startCoords } = initialResizeState.current;
    const dx = worldCoords.x - startCoords.x;
    const dy = worldCoords.y - startCoords.y;
    
    let startX = initialEl.startX;
    let startY = initialEl.startY;
    let width = initialEl.width;
    let height = initialEl.height;
    
    const minSize = 15;
    
    if (initialEl.tool === 'text') {
      const initialFontSize = initialEl.strokeWidth * 4 + 12;
      let newFontSize = initialFontSize;
      
      if (handle === 'BR' || handle === 'BL') {
        newFontSize = Math.max(12, initialFontSize + dy);
      } else if (handle === 'TR' || handle === 'TL') {
        newFontSize = Math.max(12, initialFontSize - dy);
      }
      
      const newStrokeWidth = Math.max(1, Math.round((newFontSize - 12) / 4));
      const actualNewFontSize = newStrokeWidth * 4 + 12;
      
      let startX = initialEl.startX;
      let startY = initialEl.startY;
      
      if (handle === 'BR' || handle === 'BL') {
        startY = initialEl.startY - initialFontSize + actualNewFontSize;
      }
      
      if (handle === 'BL' || handle === 'TL') {
        const initialWidth = getTextWidth(initialEl.text, initialEl.strokeWidth);
        const newWidth = getTextWidth(initialEl.text, newStrokeWidth);
        startX = initialEl.startX + initialWidth - newWidth;
      }
      
      const updates = { strokeWidth: newStrokeWidth, startX, startY };
      dispatch(updateElement({ id: initialEl.id, updates }));
      if (socket) {
        socket.emit('update-element', { roomId, id: initialEl.id, updates });
      }
      return;
    }
    
    if (initialEl.tool === 'circle') {
      const dist = Math.hypot(worldCoords.x - initialEl.startX, worldCoords.y - initialEl.startY);
      const newRadius = Math.max(minSize, dist);
      const w = newRadius / Math.sqrt(2);
      dispatch(updateElement({ id: initialEl.id, updates: { width: w, height: w } }));
      if (socket) {
        socket.emit('update-element', { roomId, id: initialEl.id, updates: { width: w, height: w } });
      }
      return;
    }
    
    if (handle === 'BR') {
      width = Math.max(minSize, initialEl.width + dx);
      height = Math.max(minSize, initialEl.height + dy);
    } else if (handle === 'TR') {
      width = Math.max(minSize, initialEl.width + dx);
      const proposedHeight = initialEl.height - dy;
      if (proposedHeight >= minSize) {
        height = proposedHeight;
        startY = initialEl.startY + dy;
      }
    } else if (handle === 'TL') {
      const proposedWidth = initialEl.width - dx;
      const proposedHeight = initialEl.height - dy;
      if (proposedWidth >= minSize) {
        width = proposedWidth;
        startX = initialEl.startX + dx;
      }
      if (proposedHeight >= minSize) {
        height = proposedHeight;
        startY = initialEl.startY + dy;
      }
    } else if (handle === 'BL') {
      const proposedWidth = initialEl.width - dx;
      if (proposedWidth >= minSize) {
        width = proposedWidth;
        startX = initialEl.startX + dx;
      }
      height = Math.max(minSize, initialEl.height + dy);
    }
    
    const updates = { startX, startY, width, height };
    dispatch(updateElement({ id: initialEl.id, updates }));
    if (socket) {
      socket.emit('update-element', { roomId, id: initialEl.id, updates });
    }
  };

  const handlePointerMove = (e) => {
    const { clientX, clientY } = e;
    const worldCoords = getWorldCoordinates(clientX, clientY);
    
    if (socket && roomId) {
      socket.emit('cursor-move', { roomId, socketId: socket.id, x: worldCoords.x, y: worldCoords.y, color });
    }

    if (isResizingRef.current && initialResizeState.current) {
      handleResizeMove(worldCoords);
      return;
    }

    if (activeTool === 'select' && isDraggingRef.current && dragStartPositions.current) {
      const dx = worldCoords.x - dragOffset.current.x;
      const dy = worldCoords.y - dragOffset.current.y;
      console.log('Dragging selection:', { dx, dy, count: Object.keys(dragStartPositions.current).length });
      
      Object.entries(dragStartPositions.current).forEach(([id, startPos]) => {
        let updates = {};
        if (startPos.points) {
          updates = {
            points: startPos.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
          };
        } else {
          updates = {
            startX: startPos.startX + dx,
            startY: startPos.startY + dy
          };
        }
        dispatch(updateElement({ id, updates }));
        if (socket) {
          socket.emit('update-element', { roomId, id, updates });
        }
      });
      return;
    }

    if (isDrawingMarquee) {
      setMarqueeEnd(worldCoords);
      
      const x1 = Math.min(marqueeStart.x, worldCoords.x);
      const x2 = Math.max(marqueeStart.x, worldCoords.x);
      const y1 = Math.min(marqueeStart.y, worldCoords.y);
      const y2 = Math.max(marqueeStart.y, worldCoords.y);
      
      const intersectedIds = [];
      elements.forEach(el => {
        const bounds = getElementBounds(el);
        const intersects = !(bounds.minX > x2 || bounds.maxX < x1 || bounds.minY > y2 || bounds.maxY < y1);
        if (intersects) {
          intersectedIds.push(el.id);
        }
      });
      setSelectedIds(intersectedIds);
      return;
    }

    if (!isDrawing) {
      // Set cursor based on resize handles hover
      if (activeTool === 'select' && selectedIds.length === 1 && !isDraggingRef.current && !isResizingRef.current && !isDrawingMarquee) {
        const el = elements.find(e => e.id === selectedIds[0]);
        if (el && (el.tool === 'rect' || el.tool === 'sticky' || el.tool === 'circle' || el.tool === 'text')) {
          const bounds = getElementBounds(el);
          const handleSize = 10;
          const corners = {
            TL: { x: bounds.minX - 5, y: bounds.minY - 5 },
            TR: { x: bounds.maxX + 5, y: bounds.minY - 5 },
            BL: { x: bounds.minX - 5, y: bounds.maxY + 5 },
            BR: { x: bounds.maxX + 5, y: bounds.maxY + 5 }
          };
          
          let foundHandle = null;
          for (const [name, pos] of Object.entries(corners)) {
            if (Math.abs(worldCoords.x - pos.x) <= handleSize &&
                Math.abs(worldCoords.y - pos.y) <= handleSize) {
              foundHandle = name;
              break;
            }
          }
          setHoveredHandle(foundHandle);
        } else {
          setHoveredHandle(null);
        }
      } else {
        setHoveredHandle(null);
      }
      return;
    }

    if (activeTool === 'pan') {
      dispatch(setPanOffset({
        x: clientX - dragOffset.current.x,
        y: clientY - dragOffset.current.y
      }));
      return;
    }

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      currentPathRef.current.push({ x: worldCoords.x, y: worldCoords.y });
      
      const context = contextRef.current;
      context.save();
      context.translate(panOffset.x, panOffset.y);
      context.scale(zoom, zoom);
      context.strokeStyle = activeTool === 'eraser' ? '#f3f2f1' : color;
      context.lineWidth = activeTool === 'highlighter' ? strokeWidth * 3 : strokeWidth;
      context.globalAlpha = activeTool === 'highlighter' ? 0.4 : 1.0;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineTo(worldCoords.x, worldCoords.y);
      context.stroke();
      context.restore();
      return;
    }

    if (currentElement && activeTool !== 'text' && activeTool !== 'sticky') {
      setCurrentElement({
        ...currentElement,
        width: worldCoords.x - currentElement.startX,
        height: worldCoords.y - currentElement.startY
      });
    }
  };

  const handleDoubleClick = (e) => {
    const { clientX, clientY } = e;
    const worldCoords = getWorldCoordinates(clientX, clientY);

    const clicked = [...elements].reverse().find(el => {
      if (el.tool === 'sticky') {
        return worldCoords.x >= el.startX && worldCoords.x <= el.startX + el.width &&
               worldCoords.y >= el.startY && worldCoords.y <= el.startY + el.height;
      } else if (el.tool === 'text') {
        const textWidth = getTextWidth(el.text, el.strokeWidth);
        const fontSize = el.strokeWidth * 4 + 12;
        return worldCoords.x >= el.startX && worldCoords.x <= el.startX + textWidth && 
               worldCoords.y >= el.startY - fontSize && worldCoords.y <= el.startY;
      }
      return false;
    });

    if (clicked) {
      setTextInput({
        visible: true,
        x: clicked.startX,
        y: clicked.startY,
        id: clicked.id,
        isSticky: clicked.tool === 'sticky',
        isEditingExisting: true,
        text: clicked.text
      });
      dispatch(setActiveTool(clicked.tool));
    }
  };

  const handlePointerDown = (e) => {
    const { clientX, clientY } = e;
    const worldCoords = getWorldCoordinates(clientX, clientY);

    if (activeTool === 'pan') {
      setIsDrawing(true);
      dragOffset.current = { x: clientX - panOffset.x, y: clientY - panOffset.y };
      return;
    }

    if (activeTool === 'text' || activeTool === 'sticky') {
      if (textInput.visible) handleTextSubmit();
      
      setTextInput({ 
        visible: true, 
        x: worldCoords.x, 
        y: worldCoords.y, 
        id: uuidv4(),
        isSticky: activeTool === 'sticky',
        isEditingExisting: false,
        text: ''
      });
      return;
    }

    if (textInput.visible) {
      handleTextSubmit();
    }

    if (activeTool === 'select') {
      // 1. Check if clicked a resize handle
      if (selectedIds.length === 1) {
        const el = elements.find(e => e.id === selectedIds[0]);
        if (el && (el.tool === 'rect' || el.tool === 'sticky' || el.tool === 'circle' || el.tool === 'text')) {
          const bounds = getElementBounds(el);
          const handleSize = 10;
          const corners = {
            TL: { x: bounds.minX - 5, y: bounds.minY - 5 },
            TR: { x: bounds.maxX + 5, y: bounds.minY - 5 },
            BL: { x: bounds.minX - 5, y: bounds.maxY + 5 },
            BR: { x: bounds.maxX + 5, y: bounds.maxY + 5 }
          };
          
          let handleFound = null;
          for (const [name, pos] of Object.entries(corners)) {
            if (Math.abs(worldCoords.x - pos.x) <= handleSize &&
                Math.abs(worldCoords.y - pos.y) <= handleSize) {
              handleFound = name;
              break;
            }
          }
          
          if (handleFound) {
            console.log('Resize handle clicked:', handleFound);
            dispatch(saveHistoryState());
            isResizingRef.current = true;
            setIsResizing(true);
            initialResizeState.current = {
              element: el,
              handle: handleFound,
              startCoords: worldCoords
            };
            return;
          }
        }
      }

      // 2. Check if clicked directly on any shape first
      const clickedShape = [...elements].reverse().find(el => isPointInElement(el, worldCoords.x, worldCoords.y));
      
      let clicked = null;
      let isInsideSelectionBox = false;
      
      if (clickedShape) {
        clicked = clickedShape;
      } else {
        // Clicked outside any shape, check if inside selection bounding box (empty space of selection)
        const isInsideSelection = isPointInSelectionBounds(worldCoords.x, worldCoords.y, selectedIds);
        if (isInsideSelection) {
          clicked = elements.find(el => selectedIds.includes(el.id));
          isInsideSelectionBox = true;
        }
      }
      
      console.log('Select pointer down. clickedShape:', clickedShape, 'isInsideSelectionBox:', isInsideSelectionBox);

      if (clicked) {
        let newSelection = [...selectedIds];
        
        if (isInsideSelectionBox) {
          // Keep current selection
        } else {
          // Clicked directly on a shape: select/toggle it
          if (e.shiftKey) {
            if (selectedIds.includes(clicked.id)) {
              newSelection = selectedIds.filter(id => id !== clicked.id);
            } else {
              newSelection.push(clicked.id);
            }
          } else {
            if (!selectedIds.includes(clicked.id)) {
              newSelection = [clicked.id];
            }
          }
        }
        
        setSelectedIds(newSelection);
        dispatch(saveHistoryState());
        isDraggingRef.current = true;
        setIsDragging(true);
        dragOffset.current = { x: worldCoords.x, y: worldCoords.y };

        // Populate initial positions for delta dragging
        const startPos = {};
        newSelection.forEach(id => {
          const el = elements.find(e => e.id === id);
          if (el) {
            // Only treat as path/points element if it is a pen/highlighter/eraser!
            // Other shapes (rect, circle, line, arrow, text, sticky) have a points array 
            // initialized on creation but must be dragged via startX and startY!
            if (el.tool === 'pen' || el.tool === 'highlighter' || el.tool === 'eraser') {
              startPos[id] = { points: el.points.map(p => ({ ...p })) };
            } else {
              startPos[id] = { startX: el.startX, startY: el.startY };
            }
          }
        });
        dragStartPositions.current = startPos;
        console.log('Started dragging selection:', newSelection, 'Start positions:', startPos);
      } else {
        // Clicking empty space
        console.log('Clicked empty space, starting marquee select');
        if (!e.shiftKey) {
          setSelectedIds([]);
        }
        setIsDrawingMarquee(true);
        setMarqueeStart(worldCoords);
        setMarqueeEnd(worldCoords);
      }
      return;
    }

    setIsDrawing(true);
    
    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      currentPathRef.current = [{ x: worldCoords.x, y: worldCoords.y }];
      const context = contextRef.current;
      context.save();
      context.translate(panOffset.x, panOffset.y);
      context.scale(zoom, zoom);
      context.beginPath();
      context.moveTo(worldCoords.x, worldCoords.y);
      context.restore();
      return;
    }

    const useColor = activeTool === 'eraser' ? '#f3f2f1' : color;
    setCurrentElement({
      id: uuidv4(),
      tool: activeTool,
      color: useColor,
      strokeWidth,
      startX: worldCoords.x,
      startY: worldCoords.y,
      width: 0,
      height: 0,
      points: [{ x: worldCoords.x, y: worldCoords.y }]
    });
  };

  const handlePointerUp = () => {
    isResizingRef.current = false;
    isDraggingRef.current = false;

    if (isResizing) {
      setIsResizing(false);
      initialResizeState.current = null;
      return;
    }

    if (isDrawingMarquee) {
      setIsDrawingMarquee(false);
      return;
    }

    if (activeTool === 'select' || activeTool === 'pan') {
      setIsDragging(false);
      setIsDrawing(false);
      dragStartPositions.current = null;
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
      const useColor = activeTool === 'eraser' ? '#f3f2f1' : color;
      const newEl = {
        id: uuidv4(),
        tool: activeTool,
        color: useColor,
        strokeWidth: activeTool === 'highlighter' ? strokeWidth * 3 : strokeWidth,
        points: currentPathRef.current
      };
      dispatch(addElement(newEl));
      if (socket && roomId) socket.emit('draw', { roomId, element: newEl });
      currentPathRef.current = [];
      return;
    }

    if (currentElement && activeTool !== 'text' && activeTool !== 'sticky') {
      let elementToSave = currentElement;
      
      // Normalize rectangle dimensions on drawing completion
      if (currentElement.tool === 'rect') {
        const x = Math.min(currentElement.startX, currentElement.startX + currentElement.width);
        const y = Math.min(currentElement.startY, currentElement.startY + currentElement.height);
        const w = Math.abs(currentElement.width);
        const h = Math.abs(currentElement.height);
        elementToSave = { ...currentElement, startX: x, startY: y, width: w, height: h };
      }
      
      dispatch(addElement(elementToSave));
      if (socket && roomId) {
        socket.emit('draw', { roomId, element: elementToSave });
      }
    }
    setCurrentElement(null);
  };

  const handleTextSubmit = () => {
    if (isCommittingRef.current) return;
    isCommittingRef.current = true;

    if (inputRef.current) {
      const val = inputRef.current.value;
      if (val.trim() !== '' || textInput.isEditingExisting) {
        if (textInput.isEditingExisting) {
          const updates = { text: val };
          dispatch(updateElement({ id: textInput.id, updates }));
          if (socket) {
            socket.emit('update-element', { roomId, id: textInput.id, updates });
          }
        } else {
          const newTextElement = {
            id: textInput.id,
            tool: textInput.isSticky ? 'sticky' : 'text',
            color: textInput.isSticky ? '#fef08a' : color, // Default yellow sticky
            strokeWidth,
            startX: textInput.x,
            startY: textInput.y,
            width: 150,
            height: 150,
            text: val
          };
          dispatch(addElement(newTextElement));
          if (socket && roomId) {
            socket.emit('draw', { roomId, element: newTextElement });
          }
          setSelectedIds([newTextElement.id]);
        }
      }
    }
    
    dispatch(setActiveTool('select'));
    setTextInput({ visible: false, x: 0, y: 0, id: null, isSticky: false, isEditingExisting: false, text: '' });
    
    setTimeout(() => {
      isCommittingRef.current = false;
    }, 50);
  };

  const handlePointerUpRef = useRef(handlePointerUp);
  useEffect(() => {
    handlePointerUpRef.current = handlePointerUp;
  }, [handlePointerUp]);

  // Global pointer up listener to handle releases anywhere (e.g. outside window, over overlays)
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current || isResizingRef.current || isDrawingMarquee || isDrawing) {
        handlePointerUpRef.current();
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [isDrawingMarquee, isDrawing]);

  const getCursorStyle = () => {
    if (activeTool === 'pan') return isDrawing ? 'cursor-grabbing' : 'cursor-grab';
    if (activeTool === 'eraser') return 'cursor-cell';
    if (activeTool === 'text' || activeTool === 'sticky') return 'cursor-text';
    if (activeTool === 'select') {
      if (hoveredHandle === 'TL' || hoveredHandle === 'BR') return 'cursor-nwse-resize';
      if (hoveredHandle === 'TR' || hoveredHandle === 'BL') return 'cursor-nesw-resize';
      if (isDragging) return 'cursor-move';
      return 'cursor-default';
    }
    return 'cursor-crosshair';
  };

  const backgroundPosition = `${panOffset.x}px ${panOffset.y}px`;

  return (
    <div 
      className="absolute inset-0 w-full h-full"
      style={{ 
        backgroundPosition,
        backgroundImage: 'radial-gradient(#d2d0ce 1px, transparent 1px)',
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onDoubleClick={handleDoubleClick}
        className={`touch-none w-full h-full absolute inset-0 ${getCursorStyle()}`}
      />
      
      {/* Text Input Layer */}
      {textInput.visible && (
        textInput.isSticky ? (
          <textarea
            key={textInput.id}
            ref={inputRef}
            defaultValue={textInput.text}
            style={{
              position: 'absolute',
              left: textInput.x * zoom + panOffset.x,
              top: textInput.y * zoom + panOffset.y,
              color: '#323130',
              fontSize: `${16 * zoom}px`,
              fontFamily: "'Segoe UI', Inter, sans-serif",
              width: `${150 * zoom}px`,
              height: `${150 * zoom}px`,
              backgroundColor: '#fef08a',
              padding: `${10 * zoom}px`,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              pointerEvents: 'auto'
            }}
            className="border-none outline-none z-50 placeholder-gray-400 resize-none overflow-hidden"
            placeholder="Write a note..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleTextSubmit();
              }
            }}
            onBlur={handleTextSubmit}
            autoFocus
          />
        ) : (
          <input
            key={textInput.id}
            ref={inputRef}
            type="text"
            defaultValue={textInput.text}
            style={{
              position: 'absolute',
              left: textInput.x * zoom + panOffset.x,
              top: (textInput.y - (strokeWidth * 4 + 12)) * zoom + panOffset.y,
              color: color,
              fontSize: `${(strokeWidth * 4 + 12) * zoom}px`,
              fontFamily: "'Segoe UI', Inter, sans-serif",
              width: `${250 * zoom}px`,
              backgroundColor: 'transparent',
              padding: '2px 4px',
              border: `${1 * zoom}px dashed #0078d4`,
              pointerEvents: 'auto'
            }}
            className="outline-none z-50 placeholder-gray-400 bg-transparent"
            placeholder="Type..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSubmit();
            }}
            onBlur={handleTextSubmit}
            autoFocus
          />
        )
      )}

      {/* Floating Action Menu for Selected Elements */}
      {selectedIds.length > 0 && activeTool === 'select' && (() => {
        const bounds = getSelectionScreenBounds(selectedIds);
        if (!bounds) return null;
        
        const firstEl = elements.find(el => el.id === selectedIds[0]);
        if (!firstEl) return null;
        const elColor = firstEl.color;
        
        const allStickies = selectedIds.every(id => {
          const el = elements.find(e => e.id === id);
          return el && el.tool === 'sticky';
        });
        
        const menuColors = allStickies 
          ? ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ffffff']
          : ['#000000', '#0078d4', '#e81123', '#ffb900', '#107c10', '#b4009e', '#008272'];
        
        const menuWidth = 240;
        const menuLeft = Math.max(10, bounds.left + (bounds.width / 2) - (menuWidth / 2));
        const menuTop = Math.max(10, bounds.top - 55);
        
        return (
          <div 
            style={{
              position: 'absolute',
              left: `${menuLeft}px`,
              top: `${menuTop}px`,
              pointerEvents: 'auto'
            }}
            className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-1.5 z-50 transition-all"
          >
            <div className="flex items-center gap-1 pr-2.5 border-r border-gray-150">
              {menuColors.map(c => (
                <button
                  key={c}
                  onClick={() => handleColorChange(selectedIds, c)}
                  style={{ backgroundColor: c }}
                  className={`w-5.5 h-5.5 rounded-full border transition-transform hover:scale-110 ${
                    elColor === c ? 'border-primary ring-1 ring-primary/30 scale-105' : 'border-gray-200'
                  }`}
                  title="Change Color"
                />
              ))}
            </div>
            
            <button
              onClick={() => handleDuplicate(selectedIds)}
              className="p-1.5 text-gray-600 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
              title="Duplicate (Ctrl+D)"
            >
              <Copy size={16} />
            </button>
            
            <button
              onClick={() => handleDelete(selectedIds)}
              className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })()}

      {/* Zoom Controls */}
      <div className="absolute bottom-6 right-6 panel-shadow rounded-xl px-2 py-1.5 flex items-center gap-2.5 z-20 select-none">
        <button 
          onClick={() => {
            const newZoom = Math.max(zoom / 1.2, 0.2);
            const mouseX = window.innerWidth / 2;
            const mouseY = window.innerHeight / 2;
            const worldX = (mouseX - panOffset.x) / zoom;
            const worldY = (mouseY - panOffset.y) / zoom;
            dispatch(setPanOffset({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom }));
            setZoom(newZoom);
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors font-medium text-lg"
          title="Zoom Out"
        >
          -
        </button>
        <button 
          onClick={() => {
            setZoom(1);
            dispatch(setPanOffset({ x: 0, y: 0 }));
          }}
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-1.5 py-1 hover:bg-gray-100 rounded transition-colors"
          title="Reset Zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button 
          onClick={() => {
            const newZoom = Math.min(zoom * 1.2, 5);
            const mouseX = window.innerWidth / 2;
            const mouseY = window.innerHeight / 2;
            const worldX = (mouseX - panOffset.x) / zoom;
            const worldY = (mouseY - panOffset.y) / zoom;
            dispatch(setPanOffset({ x: mouseX - worldX * newZoom, y: mouseY - worldY * newZoom }));
            setZoom(newZoom);
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 text-gray-600 transition-colors font-medium text-lg"
          title="Zoom In"
        >
          +
        </button>
      </div>

      {/* Cursors Layer */}
      {Object.values(cursors).map(cursor => (
        <div 
          key={cursor.socketId}
          className="absolute pointer-events-none z-40 transition-all duration-75 ease-linear"
          style={{ transform: `translate(${cursor.x * zoom + panOffset.x}px, ${cursor.y * zoom + panOffset.y}px)` }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={cursor.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill={cursor.color} fillOpacity="0.5" />
          </svg>
          <div className="bg-white/80 backdrop-blur-md px-2 py-0.5 rounded shadow-sm text-[10px] font-semibold mt-1 border border-gray-100" style={{ color: cursor.color }}>
            Collaborator
          </div>
        </div>
      ))}
    </div>
  );
};

export default CanvasArea;
