import express from 'express';
import {
    googleLogin, 
    facebookLogin,
    googleAuthRedirect,
    googleCallback,
    getUserById
} from '../controllers/UserController.js';

const router = express.Router();

// 1. Static POST routes
router.post('/google', googleLogin);
router.post('/facebook', facebookLogin);

// 2. Static GET routes for Google OAuth (Checked first)
router.get('/google', googleAuthRedirect);
router.get('/google/callback', googleCallback);

// 3. Dynamic GET route for User IDs (Checked last)
router.get('/:userId', getUserById);

export default router;