import Notification from '../models/Notification.js';

// @desc    Create a new notification (Internal system utility helper)
// This can be imported and called inside your trade/withdrawal/worker files directly
export const createNotificationHelper = async (userId, title, message, type = 'info') => {
    try {
        await Notification.create({ userId, title, message, type });
        return true;
    } catch (error) {
        console.error('❌ Notification creation failed:', error.message);
        return false;
    }
};

// @desc    Get all notifications for a specific user
// @route   GET /api/notifications/user/:userId
export const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch user notifications sorted from newest to oldest
        const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark a single notification as read
// @route   PUT /api/notifications/:id/read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        const notification = await Notification.findByIdAndUpdate(
            id,
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark all notifications as read for a user
// @route   PUT /api/notifications/user/:userId/read-all
export const markAllAsRead = async (req, res) => {
    try {
        const { userId } = req.params;

        await Notification.updateMany({ userId, isRead: false }, { isRead: true });

        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
