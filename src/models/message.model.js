import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({

    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    receiverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,   
    },
    message: {
        type: String,
        default: "",
    },
    type: {
        type: String,
        enum: ["text", "image", "video", "audio", "file"],
        default: "text",
    },
    fileUrl: {
        type: String,
        default: null,
    },
    isRead: {
        type: Boolean,
        default: false,
    },

}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);

