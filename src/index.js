
import dotenv from 'dotenv';
import connectDB from './db/index.js';
import { app, server, io } from './app.js';
import { Message } from './models/message.model.js';

// Load environment variables
dotenv.config({ path: './.env' });

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

  //  socket.on('markMessagesRead', async ({ userId, contactId }) => {
  //   try {
  //     if (!userId || !contactId) return;

  //     // Mark all unread messages from contact → user as read
  //     await Message.updateMany(
  //       { senderId: contactId, receiverId: userId, isRead: false },
  //       { $set: { isRead: true } }
  //     );

  //     console.log(`✅ Messages marked as read by ${userId} (from ${contactId})`);

  //     // Notify sender so their ticks update
  //     io.to(contactId).emit('messagesRead', { receiverId: userId });
  //   } catch (err) {
  //     console.error('❌ Error in markMessagesRead:', err);
  //   }
  // });

  socket.on('markMessagesRead', async ({ userId, contactId }) => {
  try {
    if (!userId || !contactId) return;

    // 1) Update DB and get updated docs' ids (so we can tell clients exactly which messages changed)
    const res = await Message.find({
      senderId: contactId,
      receiverId: userId,
      isRead: false,
    }).select('_id');

    const updatedIds = res.map(m => m._id.toString());

    if (updatedIds.length > 0) {
      await Message.updateMany(
        { senderId: contactId, receiverId: userId, isRead: false },
        { $set: { isRead: true } }
      );

      console.log(`✅ Marked ${updatedIds.length} messages as read by ${userId} from ${contactId}`);
    }

    // 2) Emit event to the sender (contactId). Include readerId and updated message ids.
    // ensure contactId is string
    io.to(contactId.toString()).emit('messagesRead', {
      readerId: userId,
      updatedMessageIds: updatedIds,
    });

    // 3) (optional) emit back to reader so their UI can be consistent
    socket.emit('messagesMarkedLocal', { updatedMessageIds: updatedIds });

  } catch (err) {
    console.error('❌ Error in markMessagesRead:', err);
  }
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
