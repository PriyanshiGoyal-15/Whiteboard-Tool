import { configureStore } from '@reduxjs/toolkit';
import whiteboardReducer from './whiteboardSlice';

export const store = configureStore({
  reducer: {
    whiteboard: whiteboardReducer,
  },
});
