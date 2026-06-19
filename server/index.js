require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', 
    methods: ['GET', 'POST']
  }
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/whiteboard';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

const WhiteboardSchema = new mongoose.Schema({
  roomId: String,
  elements: Array, 
  updatedAt: { type: Date, default: Date.now }
});
const Whiteboard = mongoose.model('Whiteboard', WhiteboardSchema);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
    
    try {
      const board = await Whiteboard.findOne({ roomId });
      if (board) {
        socket.emit('init-state', board.elements);
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('draw', (data) => {
    socket.to(data.roomId).emit('draw', data.element);
  });

  socket.on('update-element', (data) => {
    socket.to(data.roomId).emit('update-element', data);
  });

  socket.on('delete-element', (data) => {
    socket.to(data.roomId).emit('delete-element', data.id);
  });

  socket.on('cursor-move', (data) => {
    socket.to(data.roomId).emit('cursor-move', data);
  });

  socket.on('clear', async (roomId) => {
    socket.to(roomId).emit('clear');
    try {
      await Whiteboard.findOneAndUpdate({ roomId }, { elements: [] }, { upsert: true });
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('save-state', async ({ roomId, elements }) => {
    try {
      await Whiteboard.findOneAndUpdate(
        { roomId },
        { elements, updatedAt: Date.now() },
        { upsert: true }
      );
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('sync-board', async (data) => {
    socket.to(data.roomId).emit('init-state', data.elements);
    try {
      await Whiteboard.findOneAndUpdate(
        { roomId: data.roomId },
        { elements: data.elements, updatedAt: Date.now() },
        { upsert: true }
      );
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
