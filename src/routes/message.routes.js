import { sendMessage, getConversation, markAsRead, getUserChats, deleteMessage,getUserConversations, deleteConversation } from "../controllers/message.controller.js";
import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.js";


const router = Router();

// Protected routes
router.post("/sendmessage", upload.single("file"), sendMessage);
router.route("/getconversation/:userId/:contactId").get(getConversation);
router.route("/getuserconversation/:userId").get(getUserConversations);
router.route("/markasread/:userId/:contactId").put(markAsRead);
router.route("/getuserchats/:userId").get(verifyJWT, getUserChats);
router.route("/deletemessage/:messageId/:userId").delete(deleteMessage);
router.route("/deleteconversation/:userId/:contactId").delete(deleteConversation);

export default router;