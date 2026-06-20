import { createSlice } from '@reduxjs/toolkit';

const MAX_HISTORY = 50;

const pushHistory = (historyArr, snapshot) => {
  historyArr.push(snapshot);
  if (historyArr.length > MAX_HISTORY) {
    historyArr.splice(0, historyArr.length - MAX_HISTORY);
  }
};

const initialState = {
  elements: [],
  history: [],
  redoHistory: [],
  activeTool: 'pen', 
  color: '#0078d4',
  strokeWidth: 3,
  panOffset: { x: 0, y: 0 },
  backgroundType: localStorage.getItem('board-background') || 'dots-light'
};

const whiteboardSlice = createSlice({
  name: 'whiteboard',
  initialState,
  reducers: {
    setPanOffset: (state, action) => {
      state.panOffset = action.payload;
    },
    setElements: (state, action) => {
      state.elements = action.payload;
    },
    saveHistoryState: (state) => {
      pushHistory(state.history, JSON.parse(JSON.stringify(state.elements)));
      state.redoHistory = [];
    },
    addElement: (state, action) => {
      pushHistory(state.history, JSON.parse(JSON.stringify(state.elements)));
      state.redoHistory = [];
      state.elements.push(action.payload);
    },
    updateElement: (state, action) => {
      const { id, updates } = action.payload;
      const index = state.elements.findIndex(el => el.id === id);
      if (index !== -1) {
        state.elements[index] = { ...state.elements[index], ...updates };
      }
    },
    setBackgroundType: (state, action) => {
      state.backgroundType = action.payload;
      localStorage.setItem('board-background', action.payload);
    },
    deleteElement: (state, action) => {
      const id = action.payload;
      pushHistory(state.history, JSON.parse(JSON.stringify(state.elements)));
      state.redoHistory = [];
      state.elements = state.elements.filter(el => el.id !== id);
    },
    duplicateElement: (state, action) => {
      const { id, newId } = action.payload;
      const original = state.elements.find(el => el.id === id);
      if (original) {
        pushHistory(state.history, JSON.parse(JSON.stringify(state.elements)));
        state.redoHistory = [];
        const duplicated = {
          ...original,
          id: newId,
          startX: original.startX !== undefined ? original.startX + 20 : undefined,
          startY: original.startY !== undefined ? original.startY + 20 : undefined,
          points: original.points ? original.points.map(p => ({ x: p.x + 20, y: p.y + 20 })) : undefined
        };
        state.elements.push(duplicated);
      }
    },
    undo: (state) => {
      if (state.history.length > 0) {
        const prev = state.history.pop();
        pushHistory(state.redoHistory, JSON.parse(JSON.stringify(state.elements)));
        state.elements = prev;
      }
    },
    redo: (state) => {
      if (state.redoHistory.length > 0) {
        const next = state.redoHistory.pop();
        pushHistory(state.history, JSON.parse(JSON.stringify(state.elements)));
        state.elements = next;
      }
    },
    clearBoard: (state) => {
      pushHistory(state.history, JSON.parse(JSON.stringify(state.elements)));
      state.redoHistory = [];
      state.elements = [];
    },
    setActiveTool: (state, action) => {
      state.activeTool = action.payload;
    },
    setColor: (state, action) => {
      state.color = action.payload;
    },
    setStrokeWidth: (state, action) => {
      state.strokeWidth = action.payload;
    }
  },
});

export const {
  setElements,
  saveHistoryState,
  addElement,
  updateElement,
  setBackgroundType,
  deleteElement,
  duplicateElement,
  undo,
  redo,
  clearBoard,
  setActiveTool,
  setColor,
  setStrokeWidth,
  setPanOffset
} = whiteboardSlice.actions;

export default whiteboardSlice.reducer;
