import { Message } from "../models/message.model.js";
import { uploadImage } from "../utils/cloudinary.js";
import fs from "fs";
import { ApiResponse } from "../utils/ApiResposnse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";

const sendMessage = asyncHandler(async (req, res) => {
  const { senderId, receiverId, message, type } = req.body || {};
  if (!senderId || !receiverId) {
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

  if (sender.blockedUsers.includes(receiverId)) {
    throw new ApiError(
      403,
      "You have blocked this user. Unblock to send messages."
    );
  }
  if (receiver.blockedUsers.includes(senderId)) {
    throw new ApiError(403, "You are blocked by this user.");
  }

  let fileUrl = null;
  let finalType = type || "text";

  if (req.file) {
    try {
      const result = await uploadImage(req.file.path);
      fileUrl = result.secure_url;
      finalType = result.resource_type;
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.error("Error uploading file:", error);
      throw new ApiError(500, "Error uploading file");
    }
  }

  const newMessage = await Message.create({
    senderId,
    receiverId,
    message: message || "",
    type: finalType,
    fileUrl,
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
      { senderId: contactId, receiverId: userId },
    ],
  }).sort({ createdAt: 1 }); // Sort by creation time ascending

  const visibleMessages = messages.filter((msg) => !msg.deleteFor.includes(userId));

  return res
    .status(200)
    .json(new ApiResponse(200, visibleMessages, "Conversation fetched successfully"));
});

const getUserConversations = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new ApiError(400, "UserId is required");
  }

  // 1. Fetch all messages where user is either sender or receiver
  const messages = await Message.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).sort({ createdAt: -1 });

  // 2. Group by contactId (the other participant)
  const conversations = {};
  messages.forEach((msg) => {
    const contactId =
      msg.senderId.toString() === userId.toString()
        ? msg.receiverId.toString()
        : msg.senderId.toString();

    // Store only the latest message for each contact
    if (!conversations[contactId]) {
      conversations[contactId] = msg;
    }
  });

  // 3. Populate contact user details
  const contactIds = Object.keys(conversations);
  const contacts = await User.find({ _id: { $in: contactIds } }).select(
    "username email"
  );

  // 4. Combine last message with contact info
  const result = contactIds.map((contactId) => {
    const lastMessage = conversations[contactId];
    const contact = contacts.find((c) => c._id.toString() === contactId);

    return {
      contact: contact || { _id: contactId }, // fallback in case user deleted
      lastMessage,
    };
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, result, "User conversations fetched successfully")
    );
});

const markAsRead = asyncHandler(async (req, res) => {
  try {
    const { userId, contactId } = req.params;

    if (!userId || !contactId) {
      return res.status(400).json({ message: "Missing parameters" });
    }

    // ✅ update all messages where receiver is user and sender is contact
    const result = await Message.updateMany(
      { senderId: contactId, receiverId: userId, isRead: false },
      { $set: { isRead: true } }
    );

    // ✅ Optional: emit to sender for live read receipts
    req.io.to(contactId).emit("messagesRead", { receiverId: userId });

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error in markAsRead:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

const getUserChats = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const messages = await Message.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).sort({ createdAt: -1 });

  // Build a unique contact list with the last message
  const chats = {};
  messages.forEach((msg) => {
    const contactId =
      msg.senderId.toString() === userId ? msg.receiverId : msg.senderId;
    if (!chats[contactId]) chats[contactId] = msg;
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        Object.values(chats),
        "User chats fetched successfully"
      )
    );
});

const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId, userId } = req.params;

  const message = await Message.findById(messageId);
  if (!message) throw new ApiError(404, "Message not found");

  message.isDeleted = true;
  message.message = "";

  if (!message.deleteFor.includes(userId)){
    message.deleteFor.push(userId);
    await message.save();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, message, "Message deleted successfully"));
});

const deleteConversation = asyncHandler(async (req, res) => {
  const { userId, contactId } = req.params;

  if (!userId || !contactId) {
    throw new ApiError(400, "Both IDs are required");
  }

  const result = await Message.deleteMany({
    $or: [
      { senderId: userId, receiverId: contactId },
      { senderId: contactId, receiverId: userId },
    ],
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Conversation deleted successfully"));
});

export {
  sendMessage,
  getConversation,
  getUserConversations,
  markAsRead,
  getUserChats,
  deleteMessage,
  deleteConversation,
};
