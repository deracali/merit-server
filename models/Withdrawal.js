import mongoose from 'mongoose';

const WithdrawalSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        amount: { type: Number, required: true, min: 0.01 },
        currency: { type: String, required: true, uppercase: true }, // e.g., "USD", "BTC"

        // Dynamic payout methods
        payoutMethod: {
            type: String,
            enum: ['bank_account', 'crypto_wallet'],
            required: true
        },
        // Stores the selected bank details or crypto wallet details used for the transaction
        payoutDetails: { type: Object, required: true },

        status: {
            type: String,
            enum: ['pending', 'approved', 'completed', 'failed', 'cancelled'],
            default: 'pending'
        },
        // Automatically set to 48 hours from the exact moment of creation
        eligibleReleaseAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 48 * 60 * 60 * 1000) // Current time + 48 hours
        }
    },
    { timestamps: true }
);

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);
export default Withdrawal;
