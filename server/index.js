require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');

// ─── Express App ────────────────────────────────────────────────────────────
const app = express();

// Security headers (disable contentSecurityPolicy for Socket.io compatibility)
app.use(helmet({ contentSecurityPolicy: false }));

let ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
if (ALLOWED_ORIGIN.endsWith('/')) ALLOWED_ORIGIN = ALLOWED_ORIGIN.slice(0, -1);
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '2mb' }));

// Health check endpoint
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

const server = http.createServer(app);

// ─── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST']
  },
  // Graceful reconnect — don't drop connection on brief network blip
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── MongoDB ────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whiteboard';
const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/whiteboard';

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.info('[DB] Connected to MongoDB');
  } catch (err) {
    console.error(`[DB] Connection error: ${err.message}`);
    if (MONGO_URI !== LOCAL_MONGO_URI) {
      console.info('[DB] Attempting fallback to local MongoDB...');
      try {
        await mongoose.connect(LOCAL_MONGO_URI, { serverSelectionTimeoutMS: 5000 });
        console.info('[DB] Connected to local MongoDB fallback');
      } catch (localErr) {
        console.error('[DB] Local MongoDB fallback connection error:', localErr.message);
        process.exit(1);
      }
    } else {
      process.exit(1);
    }
  }
}

connectDB();

const WhiteboardSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  elements: { type: Array, default: [] },
  background: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
});

const Whiteboard = mongoose.model('Whiteboard', WhiteboardSchema);

// Check if room exists endpoint
app.get('/rooms/:roomId/exists', async (req, res) => {
  const { roomId } = req.params;
  try {
    const board = await Whiteboard.findOne({ roomId }).lean();
    res.json({ exists: !!board });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Validation Helpers ──────────────────────────────────────────────────────
const isValidRoomId = (id) =>
  typeof id === 'string' && id.length > 0 && id.length <= 128;

const isValidElements = (el) =>
  Array.isArray(el) && el.length <= 10_000; // Guard against absurdly large payloads

// ─── Socket Events ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.info(`[WS] Connected: ${socket.id}`);

  // Per-socket rate-limit state for save-state
  let lastSaveTime = 0;
  const SAVE_THROTTLE_MS = 800;

  socket.on('join-room', async (roomId) => {
    if (!isValidRoomId(roomId)) {
      socket.emit('error', { message: 'Invalid roomId' });
      return;
    }

    socket.join(roomId);
    console.info(`[WS] ${socket.id} joined room: ${roomId}`);

    try {
      const board = await Whiteboard.findOne({ roomId }).lean();
      if (board) {
        socket.emit('init-state', {
          elements: board.elements || [],
          background: board.background || null
        });
      } else {
        socket.emit('init-state', { elements: [], background: null });
      }
    } catch (err) {
      console.error('[WS] join-room DB error:', err.message);
      socket.emit('init-state', { elements: [], background: null });
    }
  });

  socket.on('draw', (data) => {
    if (!isValidRoomId(data?.roomId)) return;
    socket.to(data.roomId).emit('draw', data.element);
  });

  socket.on('update-element', (data) => {
    if (!isValidRoomId(data?.roomId)) return;
    socket.to(data.roomId).emit('update-element', data);
  });

  socket.on('delete-element', (data) => {
    if (!isValidRoomId(data?.roomId)) return;
    socket.to(data.roomId).emit('delete-element', data.id);
  });

  socket.on('cursor-move', (data) => {
    if (!isValidRoomId(data?.roomId)) return;
    socket.to(data.roomId).emit('cursor-move', data);
  });

  socket.on('clear', async (roomId) => {
    if (!isValidRoomId(roomId)) return;
    socket.to(roomId).emit('clear');
    try {
      await Whiteboard.findOneAndUpdate(
        { roomId },
        { elements: [], updatedAt: Date.now() },
        { upsert: true }
      );
    } catch (err) {
      console.error('[WS] clear DB error:', err.message);
    }
  });

  socket.on('save-state', async ({ roomId, elements, background } = {}) => {
    if (!isValidRoomId(roomId)) return;
    if (!isValidElements(elements)) return;

    // Per-socket throttle — max 1 save per SAVE_THROTTLE_MS
    const now = Date.now();
    if (now - lastSaveTime < SAVE_THROTTLE_MS) return;
    lastSaveTime = now;

    try {
      await Whiteboard.findOneAndUpdate(
        { roomId },
        { elements, background: background || null, updatedAt: now },
        { upsert: true }
      );
    } catch (err) {
      console.error('[WS] save-state DB error:', err.message);
    }
  });

  socket.on('sync-board', async ({ roomId, elements, background } = {}) => {
    if (!isValidRoomId(roomId)) return;
    if (!isValidElements(elements)) return;

    socket.to(roomId).emit('init-state', {
      elements,
      background: background || null
    });

    try {
      await Whiteboard.findOneAndUpdate(
        { roomId },
        { elements, background: background || null, updatedAt: Date.now() },
        { upsert: true }
      );
    } catch (err) {
      console.error('[WS] sync-board DB error:', err.message);
    }
  });

  socket.on('disconnect', (reason) => {
    console.info(`[WS] Disconnected: ${socket.id} (${reason})`);
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.info(`[Server] Listening on port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.info('[Server] SIGTERM received — shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});
