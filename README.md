# StudyBoard - Collaborative Whiteboard Application

StudyBoard is a real-time, collaborative whiteboard application where multiple users can draw, add shapes, resize elements, write text, post sticky notes, and work together on an infinite zoomable/pannable canvas.

---

## 🏗️ Project Architecture (How it is built)

The project is split into two main folders:
1. **`client` (Frontend)**: The website/user interface that you see in the browser.
2. **`server` (Backend)**: The background engine that handles real-time sharing between users and saves the board to the database.

### Core Technologies
*   **Frontend**: React, Redux Toolkit (for state management), HTML5 Canvas (for rendering graphics), and Tailwind CSS (for styling).
*   **Backend**: Node.js, Express, and Socket.io (for real-time communication).
*   **Database**: MongoDB (via Mongoose) to save the board state so drawings are never lost.

---

## 📂 Folder & File Structure

Here are the main files and what they do:

```text
Whiteboard_Application/
├── client/                      # FRONTEND CODE
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopBar.jsx       # Top panel (Undo, Redo, Clear Board, Export button)
│   │   │   ├── Toolbar.jsx      # Bottom toolbar (Pen, Eraser, Shapes, Colors, thickness slider)
│   │   │   └── CanvasArea.jsx   # The main whiteboard sheet (Drawing, dragging, resizing, backgrounds)
│   │   ├── store/
│   │   │   ├── whiteboardSlice.js # Redux state manager (stores history, elements, color, background)
│   │   │   └── store.js         # Redux store config
│   │   ├── App.jsx              # App entry point (sets up real-time websocket, global shortcuts)
│   │   ├── index.css            # Custom CSS styling
│   │   └── main.jsx
│   └── package.json
│
└── server/                      # BACKEND CODE
    ├── index.js                 # Express server, MongoDB models, and Socket.io event receivers
    └── package.json
```

---

## 🔄 How the Project Flows (Data Flow)

Here is a step-by-step explanation of what happens when you use StudyBoard:

### 1. Opening the App (Initial Loading)
1. You open the browser at `http://localhost:5173`.
2. The frontend website connects to the backend server (`http://localhost:3001`) using a **WebSocket connection** (`socket.io-client`).
3. The client sends a `join-room` request to the server.
4. The server queries the **MongoDB** database to see if there is any previously saved drawing data for the room.
5. If data exists, the server retrieves it and sends an `init-state` message back. The client loads the elements into Redux, and the canvas renders them immediately.

### 2. User Drawing or Editing (Real-time Interaction)
1. When you draw a line, create a rectangle, or resize a text element:
   * **Visual Rendering**: HTML5 Canvas translates the coordinates (accounting for zoom level and pan offset) and draws the shape on your screen instantly.
   * **Redux Update**: Your action is saved to the Redux store (`whiteboardSlice.js`), updating the elements list.
2. **Websocket Sync**: The client instantly fires a socket event (e.g., `draw`, `update-element`, or `delete-element`) to the server.
3. The server receives this event and **broadcasts** it to all other users connected to the same room. Their clients update Redux and redraw their canvas, updating their screens in real-time.

### 3. Collaborator Cursors
1. Whenever you move your mouse on the canvas, your client sends a `cursor-move` event containing your mouse pointer's coordinates (adjusted for zoom/pan).
2. The server broadcasts your coordinates to other users.
3. Their browsers render a small labeled pointer showing your cursor moving on their screen in real-time.

### 4. Background Sync & Inverting Contrast
1. If a user clicks the **Canvas Background Selector** in the bottom-left corner (e.g., changing from a Light Dot background to a Dark Grid background):
   * The app switches to Dark Mode.
   * To keep drawings readable, the canvas automatically renders black strokes as white on dark themes, and white strokes as black on light themes.
   * The panels (TopBar, Toolbar, ZoomHUD) automatically adjust to dark colors.
2. The canvas background selection is saved in the browser's `localStorage` so it remains active when you refresh.

### 5. Saving to the Database (MongoDB Persistence)
1. To avoid overloading the server on every mouse movement, the client uses **Debounced Saving** (configured in `App.jsx`):
   * When you draw or change something, a timer waits for **1 second of inactivity** (drawing stops).
   * Once you stop editing, the client emits a `save-state` event to the server.
   * The server saves the updated whiteboard state (list of shapes, lines, text) to the MongoDB database.

### 6. Exporting Your Work
1. When you click **Export** in the TopBar:
   * The app creates a temporary canvas behind the scenes.
   * It fills the canvas with the currently active background color and pattern (grid lines, dots, lined-paper rules) translated and scaled to match your screen view.
   * It draws the whiteboard elements on top.
   * It converts the composite canvas into a PNG image and downloads it.

---

## 🛠️ How to Run the Project Locally

### 1. Prerequisite
* Make sure you have **Node.js** and **MongoDB** installed and running on your system.

### 2. Start the Backend Server
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node index.js
   ```
   *(The server will run on `http://localhost:3001`)*

### 3. Start the Frontend Client
1. Open a new terminal window and navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *(The client website will open on `http://localhost:5173`)*
