import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// --- SUB-SCHEMAS ---
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
    type: {
        type: String,
        enum: ['credit', 'withdraw'],
        required: true
    },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'USD' },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    description: { type: String },
    reference: { type: String, unique: true },
    receiptImage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
});

// --- MAIN USER SCHEMA ---
const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: { type: String, required: true },
        transactionPin: { type: String },
        phone: { type: String, required: true, trim: true },

        kyc: {
            firstName: { type: String, required: true, trim: true },
            lastName: { type: String, required: true, trim: true },
            dateOfBirth: { type: Date },
            address: {
                street: { type: String },
                city: { type: String },
                state: { type: String },
                country: { type: String },
                zipCode: { type: String }
            },
            isVerified: { type: Boolean, default: false }
        },

        mainBalance: { type: Number, default: 0, min: 0 },
        cryptoAccounts: [CryptoAccountSchema],
        bankAccounts: [BankAccountSchema],
        balanceHistory: [TransactionSchema]
    },
    {
        timestamps: true
    }
);

// Pre-save middleware: Safely hashes password and PIN
UserSchema.pre('save', async function () {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }

    if (this.transactionPin && this.isModified('transactionPin')) {
        const salt = await bcrypt.genSalt(10);
        this.transactionPin = await bcrypt.hash(this.transactionPin, salt);
    }
});

// Instance method: Compares password
UserSchema.methods.matchPassword = async function (enteredPassword) {
    if (!enteredPassword || !this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method: Compares PIN
UserSchema.methods.matchTransactionPin = async function (enteredPin) {
    if (!enteredPin || !this.transactionPin) return false;
    return await bcrypt.compare(enteredPin, this.transactionPin);
};

const User = mongoose.model('User', UserSchema);

export default User;
