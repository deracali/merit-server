import mongoose from 'mongoose';

const accountAddressSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['CRYPTO', 'BANK', 'PAYPAL'], // ◄ Added PAYPAL here
        uppercase: true
    },
    asset: {
        type: String,
        required: true,
        uppercase: true, // e.g., 'BTC', 'ETH', 'USD', 'NGN'
        trim: true
    },
    // PayPal Specific Fields ◄ New Block
    paypalEmail: {
        type: String,
        trim: true,
        lowercase: true,
        required: function() { return this.type === 'PAYPAL'; }
    },
    // Crypto Specific Fields
    network: {
        type: String,
        uppercase: true,
        trim: true,
        required: function() { return this.type === 'CRYPTO'; }
    },
    cryptoAddress: {
        type: String,
        trim: true,
        required: function() { return this.type === 'CRYPTO'; }
    },
    memo: {
        type: String,
        default: null
    },
    // Traditional Banking Specific Fields
    bankName: {
        type: String,
        trim: true,
        required: function() { return this.type === 'BANK'; }
    },
    accountName: {
        type: String,
        trim: true,
        required: function() { return this.type === 'BANK'; }
    },
    accountNumber: {
        type: String,
        trim: true,
        required: function() { return this.type === 'BANK'; }
    },
    routingNumber: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Update index strategy so documents missing 'network' (like BANK or PAYPAL) can co-exist uniquely
accountAddressSchema.index({ type: 1, asset: 1, network: 1 }, { unique: true, partialFilterExpression: { network: { $exists: true } } });
// Optional separate unique constraint for PayPal paths
accountAddressSchema.index({ type: 1, paypalEmail: 1 }, { unique: true, partialFilterExpression: { type: 'PAYPAL' } });

const AccountAddress = mongoose.model('AccountAddress', accountAddressSchema);
export default AccountAddress;
