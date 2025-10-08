import { registerUser, loginUser, verifyEmail, logoutUser, getUserById, getCurrentUser, getAllUsers, updateUserData, refreshAccessToken } from "../controllers/user.controller.js";
import {Router} from "express";
import { upload } from "../middlewares/multer.js";
import {verifyJWT} from "../middlewares/auth.middleware.js";


const router = Router();

router.post("/register", upload.single('avatar'), registerUser);
router.post("/login", loginUser);
router.post("/verify-email", verifyEmail);
router.post("/logout", logoutUser);
router.route("/refresh-token").post(refreshAccessToken);

//protected routes
router.route("/getuserbyid/:userId").get(getUserById);
router.route("/getcurrentuser").get(verifyJWT, getCurrentUser);
router.route("/getallusers").get(getAllUsers);
router.route("/updateuserdata/:userId").put(verifyJWT, updateUserData);


export default router;