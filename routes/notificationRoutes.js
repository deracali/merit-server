import express from 'express';
import {
    getUserNotifications,
    markAsRead,
    markAllAsRead
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/user/:userId', getUserNotifications);          // GET /api/notifications/user/:userId
router.put('/:id/read', markAsRead);                        // PUT /api/notifications/:id/read
router.put('/user/:userId/read-all', markAllAsRead);        // PUT /api/notifications/user/:userId/read-all

export default router;
