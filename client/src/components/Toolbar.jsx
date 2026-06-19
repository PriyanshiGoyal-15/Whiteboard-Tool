import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setActiveTool, setColor, setStrokeWidth } from '../store/whiteboardSlice';
import { Pencil, Eraser, Square, Circle, Minus, Type, MousePointer2, Highlighter, StickyNote, Hand, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

const COLORS = ['#000000', '#0078d4', '#e81123', '#ffb900', '#107c10', '#b4009e', '#008272'];
const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)', key: 'v' },
  { id: 'pan', icon: Hand, label: 'Pan Canvas (H)', key: 'h' },
  { id: 'pen', icon: Pencil, label: 'Pen (P)', key: 'p' },
  { id: 'highlighter', icon: Highlighter, label: 'Highlighter (I)', key: 'i' },
  { id: 'eraser', icon: Eraser, label: 'Eraser (E)', key: 'e' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky Note (N)', key: 'n' },
  { id: 'rect', icon: Square, label: 'Rectangle (R)', key: 'r' },
  { id: 'circle', icon: Circle, label: 'Circle (C)', key: 'c' },
  { id: 'line', icon: Minus, label: 'Line (L)', key: 'l' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Arrow (A)', key: 'a' },
  { id: 'text', icon: Type, label: 'Text (T)', key: 't' },
];

const Toolbar = () => {
  const dispatch = useDispatch();
  const { activeTool, color, strokeWidth, backgroundType } = useSelector((state) => state.whiteboard);
  const isDarkBackground = backgroundType && backgroundType.includes('dark');
  const [isHovered, setIsHovered] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const tool = TOOLS.find(t => t.key === e.key.toLowerCase());
      if (tool) dispatch(setActiveTool(tool.id));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1, height: isHovered ? 130 : 64 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`absolute bottom-6 left-1/2 transform -translate-x-1/2 rounded-2xl px-4 py-2 flex flex-col items-center justify-end z-20 border backdrop-blur-md transition-all duration-300 ${
        isDarkBackground 
          ? 'bg-neutral-900/90 border-neutral-800/80 text-neutral-200 shadow-neutral-950/20' 
          : 'bg-white/90 border-gray-200/80 text-gray-800 shadow-gray-200/20'
      }`}
    >
      
      {/* Expanded settings area (Colors & Stroke) */}
      <div className="w-full flex justify-between items-center px-4 pb-4 w-[500px]">
        {/* Colors Section */}
        <div className="flex flex-col gap-2">
          <motion.span 
            animate={{ opacity: isHovered ? 1 : 0, display: isHovered ? 'block' : 'none' }}
            className={`text-[10px] font-bold uppercase tracking-wider ${isDarkBackground ? 'text-neutral-500' : 'text-gray-400'}`}
          >
            Color
          </motion.span>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <motion.button
                animate={{ opacity: isHovered ? 1 : 0, display: isHovered ? 'block' : 'none' }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                key={c}
                onClick={() => dispatch(setColor(c))}
                className={`w-6 h-6 rounded-full border-2 transition-colors ${
                  color === c ? 'border-primary shadow-sm' : 'border-gray-200'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width Section */}
        <div className="flex flex-col gap-2 w-32">
          <motion.div 
            animate={{ opacity: isHovered ? 1 : 0, display: isHovered ? 'flex' : 'none' }}
            className="justify-between items-center"
          >
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkBackground ? 'text-neutral-500' : 'text-gray-400'}`}>
              Thickness
            </span>
            <span className={`text-xs font-mono px-1 rounded ${isDarkBackground ? 'text-neutral-300 bg-neutral-800' : 'text-gray-500 bg-gray-100'}`}>
              {strokeWidth}px
            </span>
          </motion.div>
          {isHovered ? (
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => dispatch(setStrokeWidth(parseInt(e.target.value)))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary ${
                isDarkBackground ? 'bg-neutral-800' : 'bg-gray-200'
              }`}
            />
          ) : <div className="h-1.5" />}
        </div>
      </div>

      {/* Tools Section (Bottom row) */}
      <div className="flex items-center gap-1 w-full justify-center">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              key={tool.id}
              onClick={() => dispatch(setActiveTool(tool.id))}
              className={`p-2.5 rounded-xl flex flex-col items-center justify-center transition-all relative group ${
                isActive 
                  ? (isDarkBackground ? 'bg-blue-950/40 text-primary shadow-sm ring-1 ring-primary/30' : 'bg-blue-50 text-primary shadow-sm ring-1 ring-primary/20') 
                  : (isDarkBackground ? 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              
              {/* Custom Tooltip */}
              <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-md">
                {tool.label}
              </div>
            </motion.button>
          );
        })}
      </div>

    </motion.div>
  );
};

export default Toolbar;
