const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve static files from /public
app.use(express.static('public'));

let queue = [];
const rooms = new Map(); // Track game state for each room

io.on('connection', socket => {
  console.log(`Client connected: ${socket.id}`);

  // When a player joins the queue
  socket.on('join_queue', () => {
    queue.push(socket);
    if (queue.length >= 2) {
      const [p1, p2] = queue.splice(0, 2);
      const room = `room_${p1.id}_${p2.id}`;

      // Initialize room state
      rooms.set(room, {
        players: [p1.id, p2.id],
        state: {} // you can add initial game state here
      });

      // Join both players to the room and notify
      p1.join(room);
      p2.join(room);
      io.to(room).emit('start_game', { room });
    }
  });

  // Handle player input
  socket.on('player_input', ({ room, input }) => {
    // Broadcast input to all in the room
    io.to(room).emit('state_update', { id: socket.id, input });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Clean up queue or rooms if needed
    queue = queue.filter(s => s.id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
