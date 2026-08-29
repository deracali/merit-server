import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        title: { type: String, required: true }, // e.g., "Yield Earned!"
        message: { type: String, required: true }, // e.g., "You have received 0.002 BTC..."
        type: {
            type: String,
            enum: ['info', 'success', 'warning', 'danger'],
            default: 'info'
        },
        isRead: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;
