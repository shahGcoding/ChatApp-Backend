
import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app } from './app.js';
import http from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config({ path: './.env' });

// Create an HTTP server from Express app
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // your frontend URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io to every request for controller access
app.use((req, res, next) => {
  req.io = io;
  next();
});

const onlineUsers = new Map();

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log(`🔗 User connected: ${socket.id}`);

  // Join a personal room for private messaging
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their room`);

     // Save online user
    onlineUsers.set(userId, socket.id);

    // Notify all clients about current online users
    io.emit('onlineUsers', Array.from(onlineUsers.keys()));

  });

  // Send message to specific user
  socket.on('sendMessage', (data) => {
    const { senderId, receiverId, message } = data;

    // Emit to the receiver's room
    io.to(receiverId).emit('receiveMessage', { senderId, message });

    // (Optional) Save to MongoDB here
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);

      // Remove user from online list
    for (let [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }

    // Update everyone
    io.emit('onlineUsers', Array.from(onlineUsers.keys()))

  });
});

// Connect to the database and start the server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to connect to the database', error);
  });
