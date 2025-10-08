import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResposnse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadImage, deleteImage } from "../utils/cloudinary.js";
import { sendVerificationCode, WelcomeEmail } from "../middlewares/email.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return {
      accessToken,
      refreshToken,
    };
  } catch (error) {
    console.error("Error generating access and refresh tokens:", error);
    throw new ApiError(500, "Internal server error while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const exitingUser = await User.findOne({ email });
  if (exitingUser) {
    throw new ApiError(400, "User already exists");
  }

  const verificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  // let avatarUrl = "";
  // if (req.file){
  //   const result = await uploadImage(req.file.path);
  //   avatarUrl = result.secure_url;
    
  //   import("fs").then(fs => {
  //     if (fs.exitsSync(req.file.path)) fs.unlinkSync(req.file.path);
  //   });

  // }

   let avatarUrl = "";
  try {
    
    if (req.file) {
      const result = await uploadImage(req.file.path);
      avatarUrl = result.secure_url;

      // Remove local file
      import("fs").then(fs => {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      });
    }

    const user = await User.create({
      username,
      email,
      password,
      avatar: avatarUrl || "",
      verificationCode,
      status: "offline",
      expireAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    // Send email verification code
    await sendVerificationCode(user.email, verificationCode);

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(404, "User not found after creation");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, createdUser, "User registered successfully"));
  } catch (error) {
    console.error("Error during user registration:", error);
    throw new ApiError(500, "Error registering user");
  }
});



//   const user = await User.create({
//     username,
//     email,
//     password,
//     verificationCode,
//     status: "offline",
//     expireAt: new Date(Date.now() + 5 * 60 * 1000),
//   });

//   sendVerificationCode(user.email, verificationCode);

//   const createdUser = await User.findById(user._id).select(
//     "-password -refreshToken"
//   );
//   if (!createdUser) {
//     throw new ApiError(404, "User not found");
//   }

//   return res
//     .status(201)
//     .json(new ApiResponse(201, createdUser, "User Register Successfuly"));
// });

const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw new ApiError(400, "code is required");
  }

  const user = await User.findOne({
    verificationCode: code,
  });
  if (!user) {
    throw new ApiError(404, "user not found");
  }

  user.verificationCode = undefined;
  user.isVerified = true;
  user.expireAt = undefined;

  await user.save();
  await WelcomeEmail(user.email, user.username);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        _id: user._id,
        email: user.email,
        username: user.username,
        isverified: user.isVerified,
      },
      "Email verified successfully"
    )
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid credentials");
  }

  if (!user.isVerified) {
    throw new ApiError(400, "Please verify your email to login");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!loggedInUser) {
    throw new ApiError(404, "User not found");
  }

  const cookieOptions = {
    httpOnly: true,
    secure: true, // Set to true in production with HTTPS
  };

  return res
    .cookie("refreshToken", refreshToken, cookieOptions)
    .cookie("accessToken", accessToken, cookieOptions)
    .status(200)
    .json(new ApiResponse(200, loggedInUser, "User logged in successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true, // Use secure cookies in production
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message, "Invalid refresh token");
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
    };
    return res
      .cookie("refreshToken", "", cookieOptions)
      .cookie("accessToken", "", cookieOptions)
      .status(200)
      .json(new ApiResponse(200, null, "User logged out successfully"));
  }

  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: null } },
    { new: true, runValidators: true }
  );

  return res
    .cookie("refreshToken", "", cookieOptions)
    .cookie("accessToken", "", cookieOptions)
    .status(200)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

const getUserById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new ApiError(400, "User id is required");
  }

  const user = await User.findById(userId).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User fetched successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Current user fetched successfully"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("-password -refreshToken");
  if (!users) {
    throw new ApiError(404, "No users found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, users, "Users fetched successfully"));
});

const updateUserData = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    throw new ApiError(400, "User id is required");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: req.body },
    { new: true, runValidators: true }
  ).select("-password -refreshToken");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
});

export {
  registerUser,
  verifyEmail,
  loginUser,
  logoutUser,
  getUserById,
  getCurrentUser,
  getAllUsers,
  updateUserData,
  refreshAccessToken,
};
