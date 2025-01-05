import asyncHandler from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
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
const searchUser = asyncHandler(async (req, res) => {
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

const  mutualfriend=asyncHandler(async(req,res)=>
{
    const {userId1,userId2}=req.query;
    const mutualFriends = await User.aggregate([
        { $match: { _id: { $in: [mongoose.Types.ObjectId(userId1), mongoose.Types.ObjectId(userId2)] } } },
        { $project: { friends: 1 } },
        { $group: { _id: null, commonFriends: { $setIntersection: ["$friends", "$friends"] } } }
      ]);
}) ;

export  
{
    searchUser,
    registerUser,
    loginUser,
    logoutUser,
    changeCurrentPassword,
};
