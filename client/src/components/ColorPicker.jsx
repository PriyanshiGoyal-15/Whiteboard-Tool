import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export const hexToRgb = (hex) => {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16)
  };
};

export const rgbToHex = (r, g, b) => {
  const toHex = (c) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const rgbToHsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
};

export const hsvToRgb = (h, s, v) => {
  h /= 360; s /= 100; v /= 100;
  let r, g, b;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export const hexToHsv = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
};

export const hsvToHex = (h, s, v) => {
  const { r, g, b } = hsvToRgb(h, s, v);
  return rgbToHex(r, g, b);
};

const PRESETS = ['#ffc0cb', '#ffd700', '#add8e6', '#98fb98', '#e6e6fa', '#ffdab9', '#ff007f', '#39ff14', '#00ffff', '#ff00ff', '#ffff00', '#ff4500', '#8b4513', '#cd853f', '#2e8b57'];

const ColorPicker = ({ color, onChange, onClose, isDarkBackground }) => {
  const [hsv, setHsv] = useState(hexToHsv(color));
  const boardRef = useRef(null);
  const hueRef = useRef(null);

  useEffect(() => {
    setHsv(hexToHsv(color));
  }, [color]);

  const handleBoardPointerDown = (e) => {
    e.preventDefault();
    if (!boardRef.current) return;
    
    const updateHsv = (clientX, clientY) => {
      const rect = boardRef.current.getBoundingClientRect();
      let x = clientX - rect.left;
      let y = clientY - rect.top;
      x = Math.max(0, Math.min(rect.width, x));
      y = Math.max(0, Math.min(rect.height, y));
      
      const s = Math.round((x / rect.width) * 100);
      const v = Math.round((1 - y / rect.height) * 100);
      
      const newHsv = { ...hsv, s, v };
      setHsv(newHsv);
      onChange(hsvToHex(newHsv.h, s, v));
    };

    updateHsv(e.clientX, e.clientY);

    const handlePointerMove = (moveEvent) => updateHsv(moveEvent.clientX, moveEvent.clientY);
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleHuePointerDown = (e) => {
    e.preventDefault();
    if (!hueRef.current) return;
    
    const updateHue = (clientX) => {
      const rect = hueRef.current.getBoundingClientRect();
      let x = clientX - rect.left;
      x = Math.max(0, Math.min(rect.width, x));
      const h = Math.round((x / rect.width) * 360);
      
      const newHsv = { ...hsv, h };
      setHsv(newHsv);
      onChange(hsvToHex(h, hsv.s, hsv.v));
    };

    updateHue(e.clientX);

    const handlePointerMove = (moveEvent) => updateHue(moveEvent.clientX);
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleHexChange = (e) => {
    let val = e.target.value;
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
      onChange(val);
    }
  };

  const rgb = hexToRgb(color);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`rounded-2xl p-4 border backdrop-blur-xl shadow-2xl flex flex-col gap-4 w-[280px] z-50 pointer-events-auto cursor-default ${
        isDarkBackground 
          ? 'bg-neutral-950/95 border-neutral-800 text-neutral-200 shadow-black/40' 
          : 'bg-white/95 border-gray-200 text-gray-800 shadow-gray-300/40'
      }`}
    >
      <div className="flex justify-between items-center select-none">
        <span className="text-xs font-bold uppercase tracking-wider">Custom Color</span>
        {onClose && (
          <button 
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:opacity-80 cursor-pointer"
          >
            Done
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {/* 2D SV Board */}
        <div 
          ref={boardRef}
          onPointerDown={handleBoardPointerDown}
          className="w-full h-[140px] rounded-xl relative overflow-hidden cursor-crosshair shadow-inner"
          style={{
            backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)`
          }}
        >
          <div 
            className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${hsv.s}%`,
              top: `${100 - hsv.v}%`,
              backgroundColor: color
            }}
          />
        </div>

        {/* Hue Slider */}
        <div 
          ref={hueRef}
          onPointerDown={handleHuePointerDown}
          className="w-full h-3 rounded-full relative cursor-pointer shadow-inner"
          style={{
            background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
          }}
        >
          <div 
            className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-md transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: `${(hsv.h / 360) * 100}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`
            }}
          />
        </div>
      </div>

      {/* Hex & RGB Inputs */}
      <div className="flex items-center gap-3 mt-1">
        <div 
          className="w-10 h-10 rounded-xl border border-white/20 shadow-inner flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex gap-2 flex-1">
          <div className="flex flex-col gap-1 flex-1">
            <span className="text-[9px] font-bold opacity-50 uppercase text-center">Hex</span>
            <input
              type="text"
              value={color.toUpperCase()}
              onChange={handleHexChange}
              className={`w-full px-1 py-1.5 rounded-lg text-xs text-center font-mono border focus:outline-none focus:ring-1 focus:ring-primary ${
                isDarkBackground ? 'bg-neutral-900 border-neutral-800 text-neutral-100' : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            />
          </div>
          {['R', 'G', 'B'].map((l, i) => {
            const val = i === 0 ? rgb.r : i === 1 ? rgb.g : rgb.b;
            return (
              <div key={l} className="flex flex-col gap-1 w-10">
                <span className="text-[9px] font-bold opacity-50 uppercase text-center">{l}</span>
                <input
                  type="text"
                  value={val}
                  readOnly
                  className={`w-full px-1 py-1.5 rounded-lg text-xs text-center font-mono border focus:outline-none ${
                    isDarkBackground ? 'bg-neutral-900 border-neutral-800 text-neutral-400' : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* More Palettes */}
      <div className="flex flex-col gap-2 mt-1">
        <span className="text-[10px] font-bold opacity-50 uppercase">More Palettes</span>
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`w-5.5 h-5.5 rounded-full border transition-transform hover:scale-110 cursor-pointer ${
                color.toLowerCase() === p.toLowerCase() ? 'border-primary ring-1 ring-primary/30 scale-105' : 'border-transparent'
              }`}
              style={{ backgroundColor: p }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default ColorPicker;
