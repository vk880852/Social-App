import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import mongoose, { isValidObjectId } from "mongoose";
//// All stuffed related to the user
const generateAccessToken=async(user)=>
{
    try{
        const accessToken=await user.generateAccessToken();
        user.accesstoken=accessToken;
        await user.save({validateBeforeSave:false});
        return {accessToken}
    }
    catch(error)
    {
        console.log("error occurs while generating refresh and access tokens",error)
    }
}
const registerUser = asyncHandler(async (req, res) => {
    const { username, fullname, email, password } = req.body;
    console.log(username,fullname,email,password);
    if ([username, fullname, email, password].some(field => field?.trim()==="")) {
        throw new ApiError(400, "All fields are required");
    }
    if (await User.findOne({ $or: [{ username }, { email }] })) {
        throw new ApiError(409, "Username or email already exists");
    }
    
    const newUser = await User.create({
        fullname,
        email,
        password,
        username:username?.toLowerCase(),
    });
    if (!newUser) {
        throw new ApiError(500, "Error creating user");
    }

    const createdUser = await User.findById(newUser._id).select("-password -accesstoken");

    return res.status(201).json(new ApiResponse(200, createdUser, "User registered successfully"));
});
const loginUser=asyncHandler(async(req,res)=>{
    const { username, email, password } = req.body;
    if(!(username||email))
    {
     throw new ApiError(400,"username and password is required");
    }
    const isUser=await User.findOne({$or:[{username},{email}]});
    if(!isUser)
    {
        throw new ApiError(400,"user does not exist");
    }
    const isPasswordvalid=await isUser.isPasswordCorrect(password);
    if(!isPasswordvalid)
    {
        throw new ApiError(401,"Password is not correct");
    }
    const {accessToken}=await generateAccessToken(isUser);
    const loginUser=await User.findById(isUser._id).select("-password -accessToken");
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(201).cookie("accesstoken",accessToken,options).json(new ApiResponse(201,{loginUser,accessToken}
        ,"User loggedin Successfully"));
})
const logoutUser = asyncHandler(async (req, res) => {
     await User.findByIdAndUpdate(
        req.user._id,
        { $unset: { accessToken: 1 } },
    );

    // Now you can perform any operation with the updated user data
    // For example, sending a response back to the client
    const option={
      httpOnly:true,
      secure:true
    }
    return res
    .status(200)
    .clearCookie("accesstoken", option)
    .json(new ApiResponse(200, {}, "User logged Out"))
});

const changeCurrentPassword=asyncHandler(async(req,res)=>{
      const {newPassword,confirmPassword,oldPassword}=req.body;
      if(newPassword!==confirmPassword)
      {
        return new ApiError(201,"newPassword and confirmPassword is not same");
      }
      const user=await User.findById(req.user._id);
      const verifypassword=await user.isPasswordCorrect(oldPassword);
      if(!verifypassword)
      {
        throw new ApiError(400,"invalid Password");
      }
      user.password=newPassword;
      await user.save({validateBeforeSave:false});
      return res.status(200).json(new ApiResponse(200,{},"password change successfully")); 
})
const searchUser = asyncHandler(async (req, res) => 
  {
    const { keyword } = req.query;
  
    if (!keyword || keyword.trim() === "") {
      return res.status(400).json(new ApiError(400, "Keyword is required for searching"));
    }
  
    try {
      const searchKeyword = keyword.trim();

      const result = await User.find(
        {
          $or: [
            { fullname: { $regex: searchKeyword, $options: "i" } },
            { username: { $regex: searchKeyword, $options: "i" } }
          ]
        }
      );
  
      return res.status(200).json(new ApiResponse(200, result, `Found ${result.length} user(s) matching the keyword`));
    } catch (error) {
      console.error("Error during user search:", error);
      return res.status(500).json(new ApiError(500, "An error occurred while searching for users"));
    }
  });
const sendFriendrequest=asyncHandler(async(req,res)=>{
     const {userId}=req.body;
     const {senderId}=req.user._id;
     if(!isValidObjectId(userId) ||!isValidObjectId(requestId))
     {
       throw new ApiError(401,`please enter valid userId or SenderId`);
     }
     if(userId==senderId.toString())
     {
      return res.status(400).json(new ApiError(400, "You cannot send a request to yourself"));
     }
     try 
     {
       const receiver=await User.findById(userId);
       if(!receiver)
       {
        return res.status(404).json(new ApiError(404, "User not found"));
       }
       const existingRequest = receiver.friendRequests.find(
        (req) => req.sender.toString() === senderId.toString() && req.status === "Pending"
      );
      if (existingRequest) {
        return res.status(400).json(new ApiError(400, "Friend request already sent"));
      }
      receiver.friendRequests.push({ sender: senderId, status: "Pending" });
      await receiver.save();
      receiver.friendRequests.push({sender:senderId,status:"Pending"});

      if(req.app.get("socketio"))
      {
        const io = req.app.get("socketio");
        io.to(receiver._id.toString()).emit("friend_request", { senderId, senderName: req.user.fullname });
      }
      return res.status(200).json(new ApiResponse(200, null, "Friend request sent successfully"));
     } 
     catch (error) {
      console.error("Error sending friend request:", error);
      return res.status(500).json(new ApiError(500, "An error occurred while sending friend request"));
     }
})
const  mutualfriend=asyncHandler(async(req,res)=>
{
    const {userId1,userId2}=req.query;
    const mutualFriends = await User.aggregate([
        { $match: { _id: { $in: [mongoose.Types.ObjectId(userId1), mongoose.Types.ObjectId(userId2)] } } },
        { $project: { friends: 1 } },
        { $group: { _id: null, commonFriends: { $setIntersection: ["$friends", "$friends"] } } }
      ]);
}) ;
const managefriendRequest=asyncHandler(async(req,res)=>
{
  const { senderId, action } = req.body; // senderId: who sent the request, action: Accept/Reject
  const userId = req.user._id;

  if (!senderId || !["Accept", "Reject"].includes(action)) {
    return res.status(400).json(new ApiError(400, "Invalid request data"));
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }

    const friendRequest = user.friendRequests.find(
      (req) => req.sender.toString() === senderId.toString() && req.status === "Pending"
    );

    if (!friendRequest) {
      return res.status(400).json(new ApiError(400, "Friend request not found or already managed"));
    }

    if (action === "Accept") {
      // Update request status
      friendRequest.status = "Accepted";

      // Add sender to the user's friends list
      user.friend.push(senderId);

      // Add user to the sender's friends list
      const sender = await User.findById(senderId);
      sender.friend.push(userId);
      await sender.save();
    } else if (action === "Reject") {
      friendRequest.status = "Rejected";
    }

    await user.save();

    // Notify sender via Socket.IO (if configured)
    if (req.app.get("socketio")) {
      const io = req.app.get("socketio");
      io.to(senderId.toString()).emit("friend_request_update", { userId, action });
    }

    return res.status(200).json(new ApiResponse(200, null, `Friend request ${action.toLowerCase()}ed successfully`));
  } catch (error) {
    console.error("Error managing friend request:", error);
    return res.status(500).json(new ApiError(500, "An error occurred while managing friend request"));
  }
}
);
export  
{
    sendFriendrequest,
    searchUser,
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
    mutualfriend
};
