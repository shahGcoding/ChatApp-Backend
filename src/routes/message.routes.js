import { sendMessage, getConversation, markAsRead, getUserChats, deleteMessage } from "../controllers/message.controller.js";
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router();

// Protected routes
router.route("/sendmessage").post(sendMessage);
router.route("/getconversation/:userId/:contactId").post(getConversation);
router.route("/markasread").post(markAsRead);
router.route("/getuserchats/:userId").get(verifyJWT, getUserChats);
router.route("/deletemessage/:messageId").delete(deleteMessage);

export default router;