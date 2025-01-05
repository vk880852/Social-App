import { Router } from 'express';
import { registerUser, loginUser, logoutUser, changeCurrentPassword,searchUser} from '../controllers/user.controller.js';

const router = Router();

// Register a new user
router.post('/register', registerUser);

// User login
router.post('/login', loginUser);

// User logout
router.post('/logout', logoutUser);  

// Update password
router.put('/update-password', changeCurrentPassword);  

//search user
router.get('/search',searchUser);

export default router;
