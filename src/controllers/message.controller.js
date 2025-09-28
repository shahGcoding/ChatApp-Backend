import { Message } from "../models/message.model.js";
import { ApiResponse } from "../utils/ApiResposnse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const sendMessage = asyncHandler(async (req, res) => {
  const { senderId, receiverId, message } = req.body;
  if (!senderId || !receiverId || !message) {
    throw new ApiError(400, "All fields are required");
  }

  const sender = await User.findById(senderId);
  if (!sender) {
    throw new ApiError(404, "Sender not found");
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) {
    throw new ApiError(404, "Receiver not found");
  }

  const newMessage = await Message.create({
    senderId,
    receiverId,
    message,
    isRead: false,
  });

//   const populatedMessage = await newMessage
//     .populate("senderId", "username email")
//     .populate("receiverId", "username email");

  // Emit the message to the receiver's room
  if (req.io) {
    req.io.to(receiverId.toString()).emit("receiveMessage", newMessage);
  }

  return res
    .status(201)
    .json(new ApiResponse(201, newMessage, "Message sent successfully"));
});

const getConversation = asyncHandler(async (req, res) => {

    const { userId, contactId } = req.params;

    if (!userId || !contactId) {
        throw new ApiError(400, "Both IDs are required");
    }

    const messages = await Message.find({
        $or: [
            { senderId: userId, receiverId: contactId },
            { senderId: contactId, receiverId: userId }
        ]
    }).sort({ createdAt: 1 }); // Sort by creation time ascending

    return res.status(200).json(new ApiResponse(200, messages, "Conversation fetched successfully"));

});

const markAsRead = asyncHandler(async (req, res) => {
  const { userId, contactId } = req.body;

  const result = await Message.updateMany(
    { senderId: contactId, receiverId: userId, isRead: false },
    { $set: { isRead: true } }
  );

  // Optionally notify the sender about read receipts
  if (req.io){
  req.io.to(contactId).emit('messagesRead', { byUser: userId });
  }

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Messages marked as read"));
});

const getUserChats = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const messages = await Message.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).sort({ createdAt: -1 });

  // Build a unique contact list with the last message
  const chats = {};
  messages.forEach((msg) => {
    const contactId = msg.senderId.toString() === userId ? msg.receiverId : msg.senderId;
    if (!chats[contactId]) chats[contactId] = msg;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, Object.values(chats), "User chats fetched successfully"));
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;

  const deleted = await Message.findByIdAndDelete(messageId);
  if (!deleted) throw new ApiError(404, "Message not found");

  return res
    .status(200)
    .json(new ApiResponse(200, deleted, "Message deleted successfully"));
});

export { sendMessage, getConversation, markAsRead, getUserChats, deleteMessage };
