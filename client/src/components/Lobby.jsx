import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ArrowRight, ArrowLeft, AlertCircle, Loader2, PenTool, Sparkles } from 'lucide-react';

const ADJECTIVES = ['swift', 'silent', 'bright', 'clever', 'gentle', 'daring', 'epic', 'jolly', 'magic', 'mystic'];
const COLORS = ['blue', 'amber', 'crimson', 'emerald', 'indigo', 'violet', 'golden', 'rose', 'slate', 'teal'];
const NOUNS = ['fox', 'panda', 'koala', 'falcon', 'otter', 'badger', 'panther', 'eagle', 'tiger', 'sketch'];

const AVATAR_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#22c55e',
  '#14b8a6',
  '#eab308'
];

const generateRandomRoomId = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${color}-${noun}`;
};

const slugify = (text) => {
  return text.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

const BackgroundOrbs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      animate={{
        x: [0, 100, 0],
        y: [0, -100, 0],
        scale: [1, 1.2, 1],
      }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/30 rounded-full blur-[100px]"
    />
    <motion.div
      animate={{
        x: [0, -150, 0],
        y: [0, 150, 0],
        scale: [1, 1.5, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-teal-500/20 rounded-full blur-[120px]"
    />
    <motion.div
      animate={{
        x: [0, 50, -50, 0],
        y: [0, 50, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-rose-500/20 rounded-full blur-[90px]"
    />
  </div>
);

const Lobby = ({ onJoin }) => {
  const [step, setStep] = useState(1);
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
    if (!username.trim()) { setError('Please enter your name'); return; }
    if (username.length > 20) { setError('Name must be 20 characters or less'); return; }
    localStorage.setItem('username', username.trim());
    localStorage.setItem('userColor', selectedColor);
    setStep(2);
  };

  const handleSubmit = async (e, type) => {
    e.preventDefault();
    setError('');
    if (type === 'create') {
      const name = boardName.trim() ? slugify(boardName) : randomPlaceholder;
      if (!name) { setError('Please enter a valid board name'); return; }
      if (name.length > 64) { setError('Board name must be 64 characters or less'); return; }
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
      } catch (err) { console.warn('Backend offline:', err.message); }
      setLoading(false);
      onJoin({ username: username.trim(), roomId: name, color: selectedColor });
    } else {
      const targetRoom = slugify(roomIdInput);
      if (!targetRoom) { setError('Please enter a valid Board Name or ID'); return; }
      onJoin({ username: username.trim(), roomId: targetRoom, color: selectedColor });
    }
  };

  return (
    <div className="relative w-full min-h-screen flex items-center justify-center bg-slate-950 font-sans selection:bg-indigo-500/30 overflow-x-hidden overflow-y-auto">
      <BackgroundOrbs />
      
      <div className="relative z-10 w-full max-w-5xl mx-auto p-4 py-12 md:p-8 flex flex-col md:flex-row gap-8 items-center justify-center min-h-[600px]">
        
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full md:w-1/2 p-10 md:p-14 rounded-3xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl flex flex-col justify-center"
        >
          <div className="w-14 h-14 bg-linear-to-br from-indigo-500 to-teal-400 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/20">
            <Users className="text-white" size={24} />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
            StudyBoard
          </h1>
          <p className="text-lg text-slate-300 font-light leading-relaxed mb-10">
            A next-generation collaborative canvas. Brainstorm seamlessly with a stunningly smooth workspace.
          </p>

          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-sm font-semibold text-teal-300">1</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Create a Profile</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Choose a moniker and an accent color to represent yourself on the board.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-5">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-sm font-semibold text-teal-300">2</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Host or Join</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Spin up a fresh workspace instantly, or sync into a friend's live session.</p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-sm font-semibold text-teal-300">3</span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Flow Together</h3>
                <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">Draw, annotate, and brainstorm in real-time with zero latency constraints.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="w-full md:w-[420px] p-8 md:p-10 rounded-3xl backdrop-blur-xl bg-white/10 border border-white/20 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="flex gap-3 p-4 mb-6 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-sm backdrop-blur-sm"
              >
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step1"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleNextStep}
                className="flex flex-col gap-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Identity</h2>
                  <p className="text-sm text-slate-400 mt-2">How should others see you?</p>
                </div>

                <div className="flex flex-col gap-2 relative group">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Your Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name..."
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); if (error) setError(''); }}
                    className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400 focus:bg-white/10 outline-none transition-all text-base shadow-inner"
                  />
                </div>

                <div className="flex flex-col gap-3 ml-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cursor Color</label>
                  <div className="flex gap-3 flex-wrap mt-1">
                    {AVATAR_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        style={{ backgroundColor: color }}
                        className={`w-9 h-9 rounded-full transition-all cursor-pointer shadow-lg ${
                          selectedColor === color 
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110 shadow-current' 
                            : 'opacity-60 hover:opacity-100 hover:scale-105'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-teal-400 hover:from-indigo-400 hover:to-teal-300 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transform hover:-translate-y-0.5"
                >
                  <span>Continue</span>
                  <ArrowRight size={18} />
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Workspace</h2>
                    <p className="text-sm text-slate-400 mt-2">Enter the collaborative zone.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors -mr-2"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                </div>

                <div className="flex flex-col gap-10">
                  <form onSubmit={(e) => handleSubmit(e, 'create')} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1 ml-1">
                      <h3 className="text-[13px] font-bold text-slate-300 tracking-wide flex items-center gap-2"><Sparkles size={14} className="text-teal-400"/> Start Fresh</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder={`e.g. ${randomPlaceholder}`}
                        value={boardName}
                        disabled={loading}
                        onChange={(e) => { setBoardName(e.target.value); if (error) setError(''); }}
                        className="w-full px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-teal-400 focus:bg-white/10 outline-none transition-all text-sm shadow-inner"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl border border-white/20 hover:border-white/40 hover:bg-white/10 text-white font-semibold transition-all disabled:opacity-50 text-sm flex justify-center items-center gap-2 shadow-sm hover:shadow-md"
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : 'Host Session'}
                      </button>
                    </div>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                      <span className="bg-slate-900 px-4 text-slate-500 rounded-full border border-white/10 py-1">Or Connect</span>
                    </div>
                  </div>

                  <form onSubmit={(e) => handleSubmit(e, 'join')} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1 ml-1">
                      <h3 className="text-[13px] font-bold text-slate-300 tracking-wide flex items-center gap-2"><Users size={14} className="text-indigo-400"/> Join Existing</h3>
                    </div>
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder="Enter Room Code..."
                        value={roomIdInput}
                        disabled={loading}
                        onChange={(e) => { setRoomIdInput(e.target.value); if (error) setError(''); }}
                        className="w-full px-5 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400 focus:bg-white/10 outline-none transition-all text-sm shadow-inner"
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl bg-white text-slate-900 hover:bg-slate-200 font-bold transition-all disabled:opacity-50 text-sm flex justify-center items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        Enter Room
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

export default Lobby;
