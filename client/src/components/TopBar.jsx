import React from 'react';
import { useSelector } from 'react-redux';
import { Undo2, Redo2, Download, Trash2, Users, Wifi, WifiOff, Loader } from 'lucide-react';
import { motion } from 'framer-motion';

const ConnectionBadge = ({ status, isDark }) => {
  const configs = {
    connected: {
      icon: <Wifi size={12} />,
      label: 'Live',
      color: isDark ? 'text-emerald-400' : 'text-emerald-600',
      dot: 'bg-emerald-500'
    },
    disconnected: {
      icon: <WifiOff size={12} />,
      label: 'Offline',
      color: isDark ? 'text-red-400' : 'text-red-500',
      dot: 'bg-red-500'
    },
    connecting: {
      icon: <Loader size={12} className="animate-spin" />,
      label: 'Connecting…',
      color: isDark ? 'text-yellow-400' : 'text-yellow-600',
      dot: 'bg-yellow-500 animate-pulse'
    }
  };

  const cfg = configs[status] ?? configs.connecting;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </div>
  );
};

const TopBar = ({ onExport, onClear, onUndo, onRedo, connectionStatus = 'connecting' }) => {
  const { history, redoHistory, backgroundType } = useSelector((state) => state.whiteboard);
  const isDarkBackground = backgroundType && backgroundType.includes('dark');

  return (
    <motion.div 
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`absolute top-4 left-4 rounded-xl px-4 py-2 flex items-center gap-3 z-20 border backdrop-blur-md transition-colors duration-300 ${
        isDarkBackground 
          ? 'bg-neutral-900/90 border-neutral-800/80 text-neutral-200 shadow-neutral-950/20' 
          : 'bg-white/90 border-gray-200/80 text-gray-800 shadow-gray-200/20'
      }`}
    >
      {/* Brand + Connection Status */}
      <div className={`flex items-center gap-2 mr-2 border-r pr-4 ${
        isDarkBackground ? 'border-neutral-800' : 'border-gray-200'
      }`}>
        <Users size={18} className="text-primary" />
        <h1 className={`text-md font-semibold tracking-wide ${
          isDarkBackground ? 'text-neutral-100' : 'text-gray-800'
        }`}>
          Study<span className="text-primary">Board</span>
        </h1>
        <div className={`h-4 w-px ${isDarkBackground ? 'bg-neutral-700' : 'bg-gray-200'}`} />
        <ConnectionBadge status={connectionStatus} isDark={isDarkBackground} />
      </div>
      
      <div className="flex items-center gap-0.5">
        <motion.button
          whileHover={history.length > 0 ? { scale: 1.05, backgroundColor: isDarkBackground ? '#262626' : '#f3f2f1' } : {}}
          whileTap={history.length > 0 ? { scale: 0.95 } : {}}
          onClick={onUndo}
          disabled={history.length === 0}
          className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
            history.length === 0 
              ? (isDarkBackground ? 'text-neutral-700 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed') 
              : (isDarkBackground ? 'text-neutral-300 hover:text-neutral-100' : 'text-gray-600 hover:text-gray-900')
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </motion.button>

        <motion.button
          whileHover={redoHistory && redoHistory.length > 0 ? { scale: 1.05, backgroundColor: isDarkBackground ? '#262626' : '#f3f2f1' } : {}}
          whileTap={redoHistory && redoHistory.length > 0 ? { scale: 0.95 } : {}}
          onClick={onRedo}
          disabled={!redoHistory || redoHistory.length === 0}
          className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
            !redoHistory || redoHistory.length === 0 
              ? (isDarkBackground ? 'text-neutral-700 cursor-not-allowed' : 'text-gray-300 cursor-not-allowed') 
              : (isDarkBackground ? 'text-neutral-300 hover:text-neutral-100' : 'text-gray-600 hover:text-gray-900')
          }`}
          title="Redo (Ctrl+Y / Cmd+Shift+Z)"
        >
          <Redo2 size={18} />
        </motion.button>
      </div>

      <motion.button
        whileHover={{ scale: 1.05, backgroundColor: isDarkBackground ? '#450a0a' : '#fee2e2' }}
        whileTap={{ scale: 0.95 }}
        onClick={onClear}
        className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
          isDarkBackground ? 'text-neutral-300 hover:text-red-400' : 'text-gray-600 hover:text-red-600'
        }`}
        title="Clear Board"
      >
        <Trash2 size={18} />
      </motion.button>

      <div className={`h-6 w-px mx-1 ${isDarkBackground ? 'bg-neutral-800' : 'bg-gray-200'}`} />

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onExport}
        className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
      >
        <Download size={16} />
        Export
      </motion.button>
    </motion.div>
  );
};

export default TopBar;
