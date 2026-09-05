import cron from 'node-cron';
import User from '../models/User.js';
import { createNotificationHelper } from '../controllers/notificationController.js';

// Configuration Safety Controls
const MAX_BALANCE = 10000000; // Hard balance ceiling per account
const MAX_DAILY_YIELD = 10000; // Maximum yield credited in a single cycle

// Tier configurations (Rates represent Annual Percentage Rates - APR)
const TIERS = [
    { level: 1, min: 20, max: 100, rate: 0.02, name: "Tier 1" },       // 2% Annual
    { level: 2, min: 100, max: 1000, rate: 0.035, name: "Tier 2" },     // 3.5% Annual
    { level: 3, min: 1000, max: 10000, rate: 0.05, name: "Tier 3" },    // 5% Annual
    { level: 4, min: 10000, max: 50000, rate: 0.075, name: "Tier 4" },  // 7.5% Annual
    { level: 5, min: 50000, max: Infinity, rate: 0.10, name: "VIP Tier (Highest)" } // 10% Annual
];

const getTierForBalance = (balance) => {
    return TIERS.find(tier => balance >= tier.min && balance <= tier.max) || null;
};

let isRunning = false;

export const processYields = async () => {
    if (isRunning) {
        console.warn('⚠️ Yield processing cycle already active. Skipping duplicate run.');
        return;
    }

    isRunning = true;
    console.log('⏳ Starting yield distribution execution...');

    try {
        const users = await User.find({ 'cryptoAccounts.0': { $exists: true } }).lean();

        if (!users || users.length === 0) {
            console.log('ℹ️ No users found with active crypto accounts.');
            return;
        }

        for (let user of users) {
            for (let cryptoAccount of user.cryptoAccounts) {
                try {
                    let currentBalance = Number(cryptoAccount.balance);

                    // Overflow safety check
                    if (!isFinite(currentBalance) || currentBalance >= MAX_BALANCE) {
                        console.warn(`⚠️ User ${user._id} on ${cryptoAccount.coinName} reached max balance limit (${currentBalance}). Skipping further additions.`);
                        continue;
                    }

                    const matchedTier = getTierForBalance(currentBalance);

                    if (!matchedTier) {
                        if (currentBalance < TIERS[0].min) {
                            console.log(`ℹ️ User ${user._id} balance (${currentBalance} ${cryptoAccount.coinName}) is below minimum Tier 1 requirement (${TIERS[0].min}).`);
                        } else {
                            console.log(`ℹ️ User ${user._id} balance (${currentBalance} ${cryptoAccount.coinName}) did not match any tier range.`);
                        }
                        continue;
                    }

                    // Convert Annual Rate to Daily Rate (rate / 365 days)
                    const dailyRate = matchedTier.rate / 365;
                    const rawYield = currentBalance * dailyRate;

                    // Cap maximum payout per distribution cycle
                    const cappedYield = Math.min(rawYield, MAX_DAILY_YIELD);
                    const dailyYield = Number(cappedYield.toFixed(8));
                    const yieldPercentageDisplay = ((matchedTier.rate * 100) / 365).toFixed(4);

                    if (dailyYield <= 0) {
                        console.warn(`⚠️ Yield calculated to 0 for User ${user._id} on ${cryptoAccount.coinName}`);
                        continue;
                    }

                    const timestamp = Date.now();
                    const uniqueRef = `YIELD-${cryptoAccount.coinName}-${user._id}-${timestamp}-${Math.floor(Math.random() * 10000)}`;

                    // Atomic update with subdocument positional matching ($)
                    const updateResult = await User.updateOne(
                        { 
                            _id: user._id, 
                            "cryptoAccounts.coinName": cryptoAccount.coinName,
                            "cryptoAccounts.balance": { $lt: MAX_BALANCE } // Additional DB-level ceiling check
                        },
                        {
                            $inc: { "cryptoAccounts.$.balance": dailyYield },
                            $push: {
                                balanceHistory: {
                                    type: 'credit',
                                    amount: dailyYield,
                                    currency: cryptoAccount.coinName,
                                    status: 'completed',
                                    description: `Daily ${yieldPercentageDisplay}% (${matchedTier.name}) compounding yield earned on ${cryptoAccount.coinName}`,
                                    reference: uniqueRef
                                }
                            }
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        const newBalance = Number((currentBalance + dailyYield).toFixed(8));

                        if (typeof createNotificationHelper === 'function') {
                            await createNotificationHelper(
                                user._id,
                                'Daily Yield Disbursed! 🚀',
                                `Your balance grew! You earned +${dailyYield} ${cryptoAccount.coinName} (${yieldPercentageDisplay}% ${matchedTier.name}). New balance: ${newBalance} ${cryptoAccount.coinName}.`,
                                'success'
                            );
                        }

                        console.log(`✅ [SUCCESS] ${matchedTier.name} yield (+${dailyYield} ${cryptoAccount.coinName}) credited to User: ${user._id}`);
                    } else {
                        console.warn(`⚠️ [UPDATE FAILED] Document matched 0 records or reached MAX_BALANCE for User: ${user._id} (${cryptoAccount.coinName})`);
                    }
                } catch (accountErr) {
                    console.error(`❌ Error processing sub-account for User ${user._id}:`, accountErr.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ Top-level error in yield processing:', error.message);
    } finally {
        isRunning = false;
    }
};

// Production Schedule (Runs once daily at Midnight UTC)
cron.schedule('0 0 * * *', processYields, {
    scheduled: true,
    timezone: "Etc/UTC"
});

// Testing Interval
setInterval(processYields, 8000);