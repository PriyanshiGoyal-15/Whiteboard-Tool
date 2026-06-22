import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ArrowRight, ArrowLeft, AlertCircle, Loader2, Paintbrush } from 'lucide-react';

const ADJECTIVES = ['swift', 'silent', 'bright', 'clever', 'gentle', 'daring', 'epic', 'jolly', 'magic', 'mystic'];
const COLORS = ['blue', 'amber', 'crimson', 'emerald', 'indigo', 'violet', 'golden', 'rose', 'slate', 'teal'];
const NOUNS = ['fox', 'panda', 'koala', 'falcon', 'otter', 'badger', 'panther', 'eagle', 'tiger', 'sketch'];

const AVATAR_COLORS = [
  '#2563eb', // Blue
  '#7c3aed', // Violet
  '#db2777', // Pink
  '#ea580c', // Orange
  '#16a34a', // Green
  '#0d9488', // Teal
  '#eab308'  // Yellow
];

const generateRandomRoomId = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${color}-${noun}`;
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const Lobby = ({ onJoin }) => {
  const [step, setStep] = useState(1); // 1: Profile setup, 2: Session options
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [selectedColor, setSelectedColor] = useState(() => localStorage.getItem('userColor') || AVATAR_COLORS[0]);
  
  const [boardName, setBoardName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  
  const [randomPlaceholder, setRandomPlaceholder] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRandomPlaceholder(generateRandomRoomId());
    const urlRoom = new URLSearchParams(window.location.search).get('room');
    if (urlRoom) {
      setRoomIdInput(urlRoom);
    }
  }, []);

  const handleNextStep = (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Please enter your name');
      return;
    }
    if (username.length > 20) {
      setError('Name must be 20 characters or less');
      return;
    }
    localStorage.setItem('username', username.trim());
    localStorage.setItem('userColor', selectedColor);
    setStep(2);
  };

  const handleSubmit = async (e, type) => {
    e.preventDefault();
    setError('');

    if (type === 'create') {
      const name = boardName.trim() ? slugify(boardName) : randomPlaceholder;
      if (!name) {
        setError('Please enter a valid board name');
        return;
      }
      if (name.length > 64) {
        setError('Board name must be 64 characters or less');
        return;
      }

      setLoading(true);
      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || '';
        const response = await fetch(`${serverUrl}/rooms/${encodeURIComponent(name)}/exists`);
        if (response.ok) {
          const data = await response.json();
          if (data.exists) {
            setError(`A board named "${name}" is already active. Please use a different name or join.`);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend offline:', err.message);
      }
      setLoading(false);
      onJoin({ username: username.trim(), roomId: name, color: selectedColor });
    } else {
      const targetRoom = slugify(roomIdInput);
      if (!targetRoom) {
        setError('Please enter a valid Board Name or ID');
        return;
      }
      onJoin({ username: username.trim(), roomId: targetRoom, color: selectedColor });
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col md:flex-row bg-white text-slate-900 font-sans selection:bg-slate-200">
      
      {/* Left Column: Minimalist Introduction & How it Works */}
      <div className="flex-1 flex flex-col justify-center p-10 md:p-16 lg:p-24 bg-slate-50/50 border-r border-slate-100">
        <div className="max-w-md w-full mx-auto">
          
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-8 shadow-sm">
            <Users className="text-white" size={20} />
          </div>
          
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-4">
            StudyBoard
          </h1>
          <p className="text-lg text-slate-500 font-light leading-relaxed mb-12">
            A minimalist workspace for real-time collaboration. Brainstorm, teach, and map out ideas seamlessly.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-slate-400">1</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Create a Profile</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">Pick a name and cursor marker color to identify yourself on the shared canvas.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-slate-400">2</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Host or Join</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">Start a fresh whiteboard session or join a collaborator's active room via a link.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-xs font-semibold text-slate-400">3</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Collaborate</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">Draw freehand, add sticky notes, insert shapes, and export your work when done.</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Right Column: Interaction Forms */}
      <div className="flex-1 flex flex-col justify-center p-10 md:p-16 lg:p-24 relative bg-white">
        <div className="max-w-sm w-full mx-auto">
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex gap-3 p-4 mb-6 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleNextStep}
                className="flex flex-col gap-8"
              >
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Get Started</h2>
                  <p className="text-sm text-slate-500 mt-2">Setup your workspace identity.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name..."
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full px-0 py-3 bg-transparent border-b border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-900 outline-none transition-colors text-lg"
                  />
                </div>

                <div className="flex flex-col gap-4">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cursor Color</label>
                  <div className="flex gap-3 flex-wrap">
                    {AVATAR_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-8 h-8 rounded-full transition-all cursor-pointer ${
                          selectedColor === color 
                            ? 'ring-2 ring-slate-900 ring-offset-2 scale-110' 
                            : 'opacity-50 hover:opacity-100 hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium flex items-center justify-center gap-2 transition-colors mt-2"
                >
                  <span>Continue</span>
                  <ArrowRight size={16} />
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-900">Join Workspace</h2>
                    <p className="text-sm text-slate-500 mt-2">Choose your session.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-900 transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                </div>

                <div className="flex flex-col gap-10">
                  {/* Host Section */}
                  <form onSubmit={(e) => handleSubmit(e, 'create')} className="flex flex-col gap-4 group">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-slate-900">Start New Whiteboard</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder={`Name (e.g. ${randomPlaceholder})`}
                        value={boardName}
                        disabled={loading}
                        onChange={(e) => {
                          setBoardName(e.target.value);
                          if (error) setError('');
                        }}
                        className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white outline-none transition-colors text-sm"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-900 font-medium transition-colors disabled:opacity-50 text-sm flex justify-center items-center gap-2"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Host Session'}
                      </button>
                    </div>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-4 text-slate-400 font-medium tracking-wider">Or</span>
                    </div>
                  </div>

                  {/* Join Section */}
                  <form onSubmit={(e) => handleSubmit(e, 'join')} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-semibold text-slate-900">Join Existing Board</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder="Enter Room Code..."
                        value={roomIdInput}
                        disabled={loading}
                        onChange={(e) => {
                          setRoomIdInput(e.target.value);
                          if (error) setError('');
                        }}
                        className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:bg-white outline-none transition-colors text-sm"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors disabled:opacity-50 text-sm flex justify-center items-center"
                      >
                        Join Session
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
};

export default Lobby;
