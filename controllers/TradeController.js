import mongoose from 'mongoose';
import Trade from '../models/Trade.js';
import User from '../models/User.js';
import Crypto from '../models/Crypto.js';
import { createNotificationHelper } from './notificationController.js'; // 👈 Added import


export const buyCrypto = async (req, res) => {
    try {
        let { userId, cryptoSymbol, cryptoAmount, fiatCurrency } = req.body;

        if (!cryptoSymbol) {
            return res.status(400).json({ success: false, message: 'Crypto symbol is required' });
        }

        const normalizedFiat = fiatCurrency ? fiatCurrency.toLowerCase() : 'usd';
        const normalizedSymbol = cryptoSymbol.trim().toUpperCase();
        const numCryptoAmount = Number(cryptoAmount);

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Find crypto asset directly by symbol (e.g., "BTC", "ETH", "USDT")
        const crypto = await Crypto.findOne({ symbol: normalizedSymbol });
        if (!crypto || !crypto.isActive) {
            return res.status(404).json({ success: false, message: `Crypto asset '${normalizedSymbol}' not available` });
        }

        const rate = crypto.rates?.[normalizedFiat] || 0;
        const totalFiatCost = Number((numCryptoAmount * rate).toFixed(2));

        const trade = await Trade.create({
            userId,
            cryptoId: crypto._id,
            type: 'buy',
            cryptoSymbol: crypto.symbol,
            fiatCurrency: normalizedFiat,
            cryptoAmount: numCryptoAmount,
            fiatAmount: totalFiatCost,
            rateApplied: rate,
            status: 'completed'
        });

        // Trigger in-app notification
        await createNotificationHelper(
            user._id,
            'Purchase Order Recorded!',
            `Successfully created buy order for ${numCryptoAmount} ${crypto.symbol} (${totalFiatCost} ${normalizedFiat.toUpperCase()}).`,
            'success'
        );

        res.status(201).json({ success: true, message: 'Purchase logged successfully', trade });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export const sellCrypto = async (req, res) => {
    try {
        let { userId, cryptoId, cryptoAmount, fiatCurrency } = req.body;

        const normalizedFiat = fiatCurrency ? fiatCurrency.toLowerCase() : 'usd';

        const user = await User.findById(userId);
        const crypto = await Crypto.findById(cryptoId);

        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        if (!crypto) return res.status(404).json({ success: false, message: 'Crypto asset not found' });

        const rate = crypto.rates?.[normalizedFiat] || 0;
        const totalFiatReturn = Number((cryptoAmount * rate).toFixed(2));

        const trade = await Trade.create({
            userId,
            cryptoId,
            type: 'sell',
            cryptoSymbol: crypto.symbol,
            fiatCurrency: normalizedFiat, // <--- Using normalized lowercase here
            cryptoAmount,
            fiatAmount: totalFiatReturn,
            rateApplied: rate,
            status: 'completed'
        });

        await createNotificationHelper(
            user._id,
            'Sale Order Recorded! 💰',
            `Successfully created sell order for ${cryptoAmount} ${crypto.symbol} (${totalFiatReturn} ${fiatCurrency.toUpperCase()}).`,
            'success'
        );

        res.status(201).json({ success: true, message: 'Sale logged successfully', trade });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get trade ledger history for a specific user
// @route   GET /api/trades/user/:userId
export const getUserTrades = async (req, res) => {
    try {
        const trades = await Trade.find({ userId: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: trades.length, data: trades });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
