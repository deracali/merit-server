import Trade from '../models/Trade.js';
import Withdrawal from '../models/Withdrawal.js';
import User from '../models/User.js';
import { createNotificationHelper } from './notificationController.js'; // 👈 Added import


export const requestWithdrawal = async (req, res) => {
    try {
        const { userId, amount, currency, payoutMethod, payoutDetails } = req.body;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        if (currency === 'USD') {
            if (user.mainBalance < amount) return res.status(400).json({ success: false, message: 'Insufficient fiat balance' });
            user.mainBalance -= Number(amount);
        } else {
            let cryptoWallet = user.cryptoAccounts.find(acc => acc.coinName === currency.toUpperCase());
            if (!cryptoWallet || cryptoWallet.balance < amount) {
                return res.status(400).json({ success: false, message: `Insufficient ${currency} balance` });
            }
            cryptoWallet.balance -= Number(amount);
        }

        // 🛠️ Map frontend options to schema enum values
        let formattedPayoutMethod;
        const normalizedMethod = payoutMethod ? payoutMethod.toUpperCase() : '';

        if (normalizedMethod === 'BANK' || normalizedMethod === 'PAYPAL') {
            formattedPayoutMethod = 'bank_account';
        } else if (normalizedMethod === 'CRYPTO') {
            formattedPayoutMethod = 'crypto_wallet';
        } else {
            // Fallback for direct matches like 'bank_account' or 'crypto_wallet'
            formattedPayoutMethod = payoutMethod;
        }

        const withdrawal = await Withdrawal.create({
            userId,
            amount,
            currency,
            payoutMethod: formattedPayoutMethod,
            payoutDetails
        });

        user.balanceHistory.push({
            type: 'withdraw',
            amount,
            currency,
            description: `Withdrawal request submitted (${payoutMethod}). 48-hour processing hold applied.`,
            reference: `WITHDRAW-HOLD-${withdrawal._id}`,
            status: 'pending'
        });

        await user.save();

        // 🔔 Trigger Hold Warning Notification
        await createNotificationHelper(
            user._id,
            'Withdrawal Requested ⏳',
            `Your request to withdraw ${amount} ${currency} has been received. Security processing will take 48 hours.`,
            'warning'
        );

        res.status(201).json({ success: true, message: 'Withdrawal verified and requested.', data: withdrawal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export const finalizeWithdrawal = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'completed' or 'failed'

        const withdrawal = await Withdrawal.findById(id);
        if (!withdrawal) return res.status(404).json({ success: false, message: 'Request record not found' });
        if (withdrawal.status !== 'pending') return res.status(400).json({ success: false, message: 'Transaction already processed' });

        const currentTime = new Date();
        if (currentTime < withdrawal.eligibleReleaseAt && status === 'completed') {
            const timeLeft = Math.ceil((withdrawal.eligibleReleaseAt - currentTime) / (1000 * 60 * 60));
            return res.status(400).json({ success: false, message: `Security Hold active. Complete in ${timeLeft} hours.` });
        }

        withdrawal.status = status;
        await withdrawal.save();

        const user = await User.findById(withdrawal.userId);
        if (user) {
            const historyItem = user.balanceHistory.find(item => item.reference === `WITHDRAW-HOLD-${withdrawal._id}`);
            if (historyItem) historyItem.status = status;

            if (status === 'failed') {
                if (withdrawal.currency === 'USD') {
                    user.mainBalance += withdrawal.amount;
                } else {
                    let cryptoWallet = user.cryptoAccounts.find(acc => acc.coinName === withdrawal.currency);
                    if (cryptoWallet) cryptoWallet.balance += withdrawal.amount;
                }
            }
            await user.save();

            // 🔔 Trigger Finalized Settlement Status Notification
            const isSuccess = status === 'completed';
            await createNotificationHelper(
                user._id,
                isSuccess ? 'Withdrawal Disbursed! ✅' : 'Withdrawal Failed/Rejected ❌',
                isSuccess
                    ? `Your payout of ${withdrawal.amount} ${withdrawal.currency} has passed verification and cleared.`
                    : `Your payout of ${withdrawal.amount} ${withdrawal.currency} could not be processed. Funds refunded.`,
                isSuccess ? 'success' : 'danger'
            );
        }

        res.status(200).json({ success: true, message: `Withdrawal marked as ${status}`, data: withdrawal });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Get consolidated recent activities (Trades & Withdrawals) for a user
// @route   GET /api/activity/user/:userId
// @access  Private
export const getRecentActivity = async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit, 10) || 10;

        const [user, trades, withdrawals] = await Promise.all([
            User.findById(userId).select('mainBalance cryptoAccounts balanceHistory').lean(),
            Trade.find({ userId }).lean(),
            Withdrawal.find({ userId }).lean()
        ]);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // DEBUG LOG: Inspect raw balanceHistory array in your terminal
        console.log('=== RAW BALANCE HISTORY ===', user.balanceHistory);

        // Standardize trades
        const tradeActivities = trades.map(trade => ({
            _id: trade._id,
            category: 'trade',
            type: trade.type,
            title: trade.type === 'buy' ? 'Crypto Purchased' : 'Crypto Sold',
            icon: trade.type === 'buy' ? 'ni-arrow-down-left' : 'ni-arrow-up-right',
            colorClass: trade.type === 'buy' ? 'text-success' : 'text-info',
            amount: trade.cryptoAmount,
            symbol: trade.cryptoSymbol,
            fiatAmount: trade.fiatAmount,
            fiatCurrency: trade.fiatCurrency,
            status: trade.status,
            date: trade.createdAt || trade.date || new Date()
        }));

        // Standardize withdrawals
        const withdrawalActivities = withdrawals.map(draw => ({
            _id: draw._id,
            category: 'withdrawal',
            type: 'withdraw',
            title: 'Funds Withdrawal',
            icon: 'ni-wallet-out',
            colorClass: 'text-warning',
            amount: draw.amount,
            symbol: (draw.currency || 'USD').toUpperCase(),
            fiatAmount: (draw.currency || 'USD').toUpperCase() === 'USD' ? draw.amount : null,
            fiatCurrency: 'USD',
            status: draw.status,
            date: draw.createdAt || draw.date || new Date()
        }));

        // Standardize balanceHistory (Deposits & Credits)
        const depositActivities = (user.balanceHistory || [])
            .filter(tx => {
                if (!tx || !tx.type) return false;
                const cleanType = tx.type.toString().trim().toLowerCase();
                return ['credit', 'deposit', 'topup', 'fund'].includes(cleanType);
            })
            .map(tx => ({
                _id: tx._id,
                category: 'deposit',
                type: tx.type,
                title: 'Account Deposit',
                icon: 'ni-arrow-down-left',
                colorClass: 'text-success',
                amount: tx.amount,
                symbol: (tx.currency || 'USD').toUpperCase(),
                fiatAmount: (tx.currency || 'USD').toUpperCase() === 'USD' ? tx.amount : null,
                fiatCurrency: 'USD',
                status: tx.status || 'completed',
                // Fallback to tx._id timestamp if createdAt/date are missing
                date: tx.createdAt || tx.date || (tx._id ? tx._id.getTimestamp() : new Date())
            }));

        // DEBUG LOG: Inspect formatted deposit activities
        console.log('=== FILTERED DEPOSIT ACTIVITIES ===', depositActivities);

        const unifiedActivityFeed = [...tradeActivities, ...withdrawalActivities, ...depositActivities]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, limit);

        res.status(200).json({
            success: true,
            balances: {
                mainBalance: user.mainBalance || 0,
                cryptoAccounts: user.cryptoAccounts || []
            },
            count: unifiedActivityFeed.length,
            data: unifiedActivityFeed
        });
    } catch (error) {
        console.error('Error in getRecentActivity:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Get all withdrawals for a specific user
// @route   GET /api/withdrawals/user/:userId
export const getUserWithdrawals = async (req, res) => {
    try {
        const list = await Withdrawal.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: list.length, data: list });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



// @desc    Get all withdrawal requests (Admin Overview)
// @route   GET /api/withdrawals
// @access  Private/Admin
export const getAllWithdrawals = async (req, res) => {
    try {
        const { status, currency, page = 1, limit = 20 } = req.query;

        // Build dynamic query filters
        const query = {};
        if (status) query.status = status;
        if (currency) query.currency = currency.toUpperCase();

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        const [list, total] = await Promise.all([
            Withdrawal.find(query)
                .populate('userId', 'name email username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            Withdrawal.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: list.length,
            total,
            page: pageNum,
            pages: Math.ceil(total / limitNum),
            data: list
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
