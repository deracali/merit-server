import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const BankAccountSchema = new mongoose.Schema({
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    routingNumber: { type: String },
    balance: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

const CryptoAccountSchema = new mongoose.Schema({
    coinName: { type: String, required: true },
    walletAddress: { type: String, required: true },
    network: { type: String, required: true },
    balance: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

const TransactionSchema = new mongoose.Schema({
    type: { type: String, enum: ['credit', 'withdraw'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    description: { type: String },
    reference: { type: String, unique: true },
    receiptImage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        // Made optional for OAuth users
        password: { type: String },
        phone: { type: String, trim: true, default: '' },
        transactionPin: { type: String },

        // OAuth Providers
        googleId: { type: String, sparse: true },
        facebookId: { type: String, sparse: true },
        authProvider: {
            type: String,
            enum: ['local', 'google', 'facebook'],
            default: 'local'
        },
        profilePicture: { type: String, default: '' },

        kyc: {
            firstName: { type: String, required: true, trim: true },
            lastName: { type: String, required: true, trim: true },
            dateOfBirth: { type: Date },
            address: {
                street: { type: String, default: '' },
                city: { type: String, default: '' },
                state: { type: String, default: '' },
                country: { type: String, default: '' },
                zipCode: { type: String, default: '' }
            },
            isVerified: { type: Boolean, default: false }
        },

        mainBalance: { type: Number, default: 0, min: 0 },
        cryptoAccounts: [CryptoAccountSchema],
        bankAccounts: [BankAccountSchema],
        balanceHistory: [TransactionSchema]
    },
    { timestamps: true }
);

// Pre-save middleware: Safely hashes password and PIN only if modified
UserSchema.pre('save', async function () {
    if (this.password && this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    if (this.transactionPin && this.isModified('transactionPin')) {
        const salt = await bcrypt.genSalt(10);
        this.transactionPin = await bcrypt.hash(this.transactionPin, salt);
    }
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    if (!enteredPassword || !this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.matchTransactionPin = async function (enteredPin) {
    if (!enteredPin || !this.transactionPin) return false;
    return await bcrypt.compare(enteredPin, this.transactionPin);
};

const User = mongoose.model('User', UserSchema);

export default User;