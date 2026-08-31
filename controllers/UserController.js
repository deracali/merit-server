import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

// Initialize Google OAuth2 Client with Redirect URI
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // e.g. http://localhost:5000/api/auth/google/callback or your deployed backend URL
);

// ====== Helper: Generate JWT Token ======
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key', {
        expiresIn: '30d',
    });
};

const COIN_MAP = {
    'BITCOIN': 'BTC',
    'BTC': 'BTC',
    'BITCOIN (BTC)': 'BTC',
    'ETHEREUM': 'ETH',
    'ETH': 'ETH',
    'ETHEREUM (ETH)': 'ETH',
    'TETHER': 'USDT',
    'USDT': 'USDT',
    'TETHER (USDT)': 'USDT',
    'USD COIN': 'USDC',
    'USDC': 'USDC',
    'USD COIN (USDC)': 'USDC',
    'BINANCE COIN': 'BNB',
    'BNB': 'BNB',
    'BNB (BNB)': 'BNB',
    'SOLANA': 'SOL',
    'SOL': 'SOL',
    'SOLANA (SOL)': 'SOL',
    'RIPPLE': 'XRP',
    'XRP': 'XRP',
    'XRP (XRP)': 'XRP'
};

const normalizeCoin = (val) => {
    if (!val) return '';
    const clean = val.toString().trim().toUpperCase();
    return COIN_MAP[clean] || clean;
};

// =========================================================
// 1. REDIRECT GOOGLE AUTHENTICATION (Browser Flow)
// =========================================================

/**
 * @route GET /api/auth/google
 * @desc  Triggers browser redirect to Google login screen
 */
export const googleAuthRedirect = (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    const url = googleClient.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        prompt: 'consent'
    });

    res.redirect(url);
};

/**
 * @route GET /api/auth/google/callback
 * @desc  Google redirects back here -> verifies user -> redirects to home.html
 */
export const googleCallback = async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.redirect('https://foretradex.vercel.app/log-in.html?error=Authorization+failed');
        }

        // Exchange authorization code for tokens
        const { tokens } = await googleClient.getToken(code);
        googleClient.setCredentials(tokens);

        // Extract user profile from ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, given_name, family_name, picture } = payload;

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                if (!user.profilePicture) user.profilePicture = picture;
                await user.save();
            }
        } else {
            user = await User.create({
                email,
                googleId,
                authProvider: 'google',
                profilePicture: picture || '',
                kyc: {
                    firstName: given_name || 'Google',
                    lastName: family_name || 'User'
                }
            });
        }

        const token = generateToken(user._id);

        // Direct browser redirect to your live home page with token attached
        res.redirect(`https://foretradex.vercel.app/home.html?token=${token}`);
    } catch (error) {
        console.error('Google Callback Error:', error.message);
        res.redirect(`https://foretradex.vercel.app/log-in.html?error=${encodeURIComponent(error.message)}`);
    }
};

// =========================================================
// 2. DIRECT TOKEN AUTHENTICATION (For Popups / SDKs)
// =========================================================

export const googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ success: false, message: 'Google ID token is required' });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, given_name, family_name, picture } = payload;

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                if (!user.profilePicture) user.profilePicture = picture;
                await user.save();
            }
        } else {
            user = await User.create({
                email,
                googleId,
                authProvider: 'google',
                profilePicture: picture || '',
                kyc: {
                    firstName: given_name || 'Google',
                    lastName: family_name || 'User'
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Google login successful',
            token: generateToken(user._id),
            data: user
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const facebookLogin = async (req, res) => {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'Facebook access token is required' });
        }

        const { data } = await axios.get(
            `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture.type(large)&access_token=${accessToken}`
        );

        const { id: facebookId, email, first_name, last_name, picture } = data;
        const userEmail = email || `${facebookId}@facebook.com`;

        let user = await User.findOne({ $or: [{ facebookId }, { email: userEmail }] });

        if (user) {
            if (!user.facebookId) {
                user.facebookId = facebookId;
                await user.save();
            }
        } else {
            user = await User.create({
                email: userEmail,
                facebookId,
                authProvider: 'facebook',
                profilePicture: picture?.data?.url || '',
                kyc: {
                    firstName: first_name || 'Facebook',
                    lastName: last_name || 'User'
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Facebook login successful',
            token: generateToken(user._id),
            data: user
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const registerUser = async (req, res) => {
    try {
        const { email, password, phone, kyc } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const firstName = kyc?.firstName || req.body.firstName;
        const lastName = kyc?.lastName || req.body.lastName;
        const dateOfBirth = kyc?.dateOfBirth || req.body.dateOfBirth;

        if (!firstName || !lastName) {
            return res.status(400).json({
                success: false,
                message: 'First name and Last name are required.'
            });
        }

        const street = kyc?.address?.street || req.body.street || '';
        const city = kyc?.address?.city || req.body.city || '';
        const state = kyc?.address?.state || req.body.state || '';
        const country = kyc?.address?.country || req.body.country || '';
        const zipCode = kyc?.address?.zipCode || req.body.zipCode || '';

        const user = await User.create({
            email,
            password,
            phone,
            kyc: {
                firstName,
                lastName,
                ...(dateOfBirth && { dateOfBirth }),
                address: { street, city, state, country, zipCode }
            }
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token: generateToken(user._id),
            data: user
        });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (!user.password) {
            return res.status(500).json({
                success: false,
                message: 'This user account was created without a password. Please register a new user.'
            });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token: generateToken(user._id),
            data: {
                _id: user._id,
                email: user.email,
                phone: user.phone,
                mainBalance: user.mainBalance
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const setTransactionPin = async (req, res) => {
    try {
        const { userId } = req.params;
        const { pin } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.transactionPin = pin;
        await user.save();

        // Convert Mongoose doc to plain object and strip password before sending
        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({
            success: true,
            message: 'Transaction PIN configured securely',
            data: userObject // <-- Return the updated user here
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
// =========================================================
// 2. CORE READ, UPDATE, & DELETE CONTROLLERS
// =========================================================

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password -transactionPin')
            .sort({ createdAt: -1 }); // Sorts by createdAt descending (newest first)

        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getUserById = async (req, res) => {
    try {
        const { userId } = req.params;

        // Change this:
        // const user = await User.findById(userId).select('-password -transactionPin');

        // To this (only excludes password):
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updatedData = { ...req.body };

        delete updatedData.password;
        delete updatedData.transactionPin;
        delete updatedData.mainBalance;
        delete updatedData.cryptoAccounts;
        delete updatedData.bankAccounts;
        delete updatedData.balanceHistory;

        const user = await User.findByIdAndUpdate(userId, updatedData, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, message: 'Profile updated successfully', data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 3. NESTED ACCOUNTS SETUPS
// =========================================================

export const addBankAccount = async (req, res) => {
    try {
        const { userId } = req.params;
        const { bankName, accountName, accountNumber, routingNumber } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.bankAccounts.push({ bankName, accountName, accountNumber, routingNumber });
        await user.save();

        res.status(200).json({ success: true, message: 'Bank details saved', data: user.bankAccounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addCryptoAccount = async (req, res) => {
    try {
        const { userId } = req.params;
        const { coinName, walletAddress, network } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const normalizedInput = normalizeCoin(coinName);

        const walletExists = user.cryptoAccounts.some(acc => {
            return normalizeCoin(acc.coinName) === normalizedInput;
        });

        if (walletExists) {
            return res.status(400).json({ success: false, message: 'Crypto account already configured' });
        }

        user.cryptoAccounts.push({
            coinName: normalizedInput,
            walletAddress,
            network
        });

        await user.save();
        res.status(200).json({ success: true, message: 'Crypto account wallet integrated successfully', data: user.cryptoAccounts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// =========================================================
// 4. CORE FINANCIAL TRANSACTIONS & REPORTING
// =========================================================

export const createTransaction = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type, amount, currency, description, reference, receiptImage, accountId, status, tradeId } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const rawCurrency = currency ? currency.toString().trim() : 'USD';
        const targetCurrency = normalizeCoin(rawCurrency);
        const transactionAmount = Number(amount);

        if (isNaN(transactionAmount) || transactionAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid transaction amount' });
        }

        const normalizedType = type ? type.toString().toLowerCase() : '';
        const isCredit = ['credit', 'deposit', 'topup', 'fund'].includes(normalizedType);
        const isDebit = ['withdraw', 'debit', 'withdrawal'].includes(normalizedType);

        if (!isCredit && !isDebit) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transaction type. Must be credit/deposit or withdraw/debit'
            });
        }

        // Set default status to 'pending' if not provided
        const transactionStatus = status ? status.toString().toLowerCase().trim() : 'pending';
        const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'];

        // Balance updates & trade status updates happen ONLY if transactionStatus is 'completed'
        if (transactionStatus === 'completed') {

            // 1. If this transaction is completing a trade, update the Trade model status
            if (tradeId) {
                await Trade.findByIdAndUpdate(tradeId, { status: 'completed' });
            }

            // 2. CRYPTO BALANCES
            if (!FIAT_CURRENCIES.includes(targetCurrency)) {
                let cryptoWallet = null;

                if (accountId) {
                    cryptoWallet = user.cryptoAccounts.id(accountId);
                } else {
                    cryptoWallet = user.cryptoAccounts.find(acc => {
                        const dbCoinNormalized = normalizeCoin(acc.coinName);
                        return dbCoinNormalized === targetCurrency;
                    });
                }

                if (!cryptoWallet) {
                    return res.status(400).json({
                        success: false,
                        message: `Please create a ${targetCurrency} wallet first`
                    });
                }

                cryptoWallet.balance = cryptoWallet.balance || 0;

                if (isDebit) {
                    if (cryptoWallet.balance < transactionAmount) {
                        return res.status(400).json({
                            success: false,
                            message: `Insufficient ${targetCurrency} crypto balance`
                        });
                    }
                    cryptoWallet.balance -= transactionAmount;
                } else if (isCredit) {
                    cryptoWallet.balance += transactionAmount;
                }
            }
            // 3. FIAT BALANCES
            else {
                user.mainBalance = user.mainBalance || 0;

                if (targetCurrency === 'USD' && isCredit) {
                    user.mainBalance += transactionAmount;
                } else if (isDebit) {
                    if (user.mainBalance < transactionAmount) {
                        return res.status(400).json({
                            success: false,
                            message: 'Insufficient USD main balance'
                        });
                    }
                    user.mainBalance -= transactionAmount;
                }
            }
        } else if (transactionStatus === 'failed' && tradeId) {
            // Update trade status to failed if transaction failed
            await Trade.findByIdAndUpdate(tradeId, { status: 'failed' });
        } else if (transactionStatus === 'pending' && tradeId) {
            // Keep associated trade pending if tradeId is provided
            await Trade.findByIdAndUpdate(tradeId, { status: 'pending' });
        }

        // Save entry into user balance history with the calculated transactionStatus (defaults to 'pending')
        user.balanceHistory.push({
            type: normalizedType,
            amount: transactionAmount,
            currency: targetCurrency,
            description,
            reference: reference || `TXN-${Date.now()}`,
            receiptImage: receiptImage || null,
            status: transactionStatus
        });

        await user.save();

        res.status(200).json({
            success: true,
            message: `Transaction created. Status: ${transactionStatus}`,
            data: {
                mainBalance: user.mainBalance,
                bankAccounts: user.bankAccounts,
                cryptoAccounts: user.cryptoAccounts,
                history: user.balanceHistory
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



export const updateTransactionStatus = async (req, res) => {
    try {
        const { userId, transactionId } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required' });
        }

        const newStatus = status.toString().toLowerCase().trim();
        const VALID_STATUSES = ['completed', 'failed', 'pending'];

        if (!VALID_STATUSES.includes(newStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be completed, failed, or pending'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // 1. Explicitly locate transaction by ID string
        const transaction = user.balanceHistory.find(
            (tx) => tx._id.toString() === transactionId.toString()
        );

        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }

        // 2. Normalize status from DB
        const currentStatus = (transaction.status || 'pending').toString().toLowerCase().trim();

        // 3. Status checks
        if (currentStatus === newStatus) {
            return res.status(400).json({
                success: false,
                message: `Transaction is already marked as ${newStatus}`
            });
        }

        if (currentStatus === 'completed' || currentStatus === 'failed') {
            return res.status(400).json({
                success: false,
                message: `Cannot update a transaction that is already ${currentStatus}`
            });
        }

        const targetCurrency = normalizeCoin(transaction.currency);
        const transactionAmount = Number(transaction.amount);
        const normalizedType = transaction.type ? transaction.type.toString().toLowerCase() : '';

        const isCredit = ['credit', 'deposit', 'topup', 'fund'].includes(normalizedType);
        const isDebit = ['withdraw', 'debit', 'withdrawal'].includes(normalizedType);
        const FIAT_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN', 'CAD', 'AUD'];

        // Apply financial updates if completing
        if (newStatus === 'completed') {
            if (transaction.tradeId) {
                await Trade.findByIdAndUpdate(transaction.tradeId, { status: 'completed' });
            }

            if (!FIAT_CURRENCIES.includes(targetCurrency)) {
                let cryptoWallet = user.cryptoAccounts.find(
                    (acc) => normalizeCoin(acc.coinName) === targetCurrency
                );

                if (!cryptoWallet) {
                    return res.status(400).json({
                        success: false,
                        message: `Wallet for ${targetCurrency} not found on user profile`
                    });
                }

                cryptoWallet.balance = cryptoWallet.balance || 0;

                if (isDebit) {
                    if (cryptoWallet.balance < transactionAmount) {
                        return res.status(400).json({
                            success: false,
                            message: `Insufficient ${targetCurrency} balance`
                        });
                    }
                    cryptoWallet.balance -= transactionAmount;
                } else if (isCredit) {
                    cryptoWallet.balance += transactionAmount;
                }
            } else {
                user.mainBalance = user.mainBalance || 0;

                if (targetCurrency === 'USD' && isCredit) {
                    user.mainBalance += transactionAmount;
                } else if (isDebit) {
                    if (user.mainBalance < transactionAmount) {
                        return res.status(400).json({
                            success: false,
                            message: 'Insufficient USD main balance'
                        });
                    }
                    user.mainBalance -= transactionAmount;
                }
            }
        } else if (newStatus === 'failed' && transaction.tradeId) {
            await Trade.findByIdAndUpdate(transaction.tradeId, { status: 'failed' });
        }

        // Save new status
        transaction.status = newStatus;
        await user.save();

        return res.status(200).json({
            success: true,
            message: `Transaction status updated to ${newStatus}`,
            data: {
                transaction,
                mainBalance: user.mainBalance,
                cryptoAccounts: user.cryptoAccounts
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getMonthlyTransactions = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const filteredHistory = user.balanceHistory.filter(tx => tx.createdAt >= thirtyDaysAgo);

        res.status(200).json({
            success: true,
            count: filteredHistory.length,
            data: filteredHistory
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
