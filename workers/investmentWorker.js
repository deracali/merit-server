import cron from 'node-cron';
import User from '../models/User.js';
import { createNotificationHelper } from '../controllers/notificationController.js';

const TIERS = [
    { level: 1, min: 20, max: 100, rate: 0.02, name: "Tier 1" },
    { level: 2, min: 101, max: 1000, rate: 0.035, name: "Tier 2" },
    { level: 3, min: 1001, max: 10000, rate: 0.05, name: "Tier 3" },
    { level: 4, min: 10001, max: 49999, rate: 0.075, name: "Tier 4" },
    { level: 5, min: 50000, max: Infinity, rate: 0.10, name: "VIP Tier (Highest)" }
];

const getTierForBalance = (balance) => {
    return TIERS.find(tier => balance >= tier.min && balance <= tier.max) || null;
};

// Execution guard to prevent query stacking over long network calls
let isRunning = false;

export const processYields = async () => {
    if (isRunning) {
        console.warn('⚠️ Yield processing cycle already active. Skipping duplicate run.');
        return;
    }

    isRunning = true;
    console.log('⏳ Processing daily compounding yield distributions...');

    try {
        // Fetch users who have at least one crypto account populated
        const users = await User.find({ 'cryptoAccounts.0': { $exists: true } });

        for (let user of users) {
            for (let cryptoAccount of user.cryptoAccounts) {
                try {
                    const currentBalance = cryptoAccount.balance;

                    // Safety guard: prevent JS Number overflow on huge balances
                    if (!isFinite(currentBalance) || currentBalance > Number.MAX_SAFE_INTEGER) {
                        console.error(`⚠️ Skipping balance overflow for User ${user._id} on ${cryptoAccount.coinName}`);
                        continue;
                    }

                    const matchedTier = getTierForBalance(currentBalance);

                    if (matchedTier) {
                        const rawYield = currentBalance * matchedTier.rate;
                        const dailyYield = Number(rawYield.toFixed(6));
                        const yieldPercentageDisplay = (matchedTier.rate * 100).toFixed(1);

                        if (dailyYield <= 0) continue;

                        const timestamp = Date.now();
                        const uniqueRef = `YIELD-${cryptoAccount.coinName}-${user._id}-${timestamp}-${Math.floor(Math.random() * 10000)}`;

                        // Query targeting the exact user AND exact subdocument ID or coinName
                        const filterQuery = cryptoAccount._id 
                            ? { _id: user._id, "cryptoAccounts._id": cryptoAccount._id }
                            : { _id: user._id, "cryptoAccounts.coinName": cryptoAccount.coinName };

                        // Atomic database update directly onto the positional array element ($)
                        const updateResult = await User.updateOne(
                            filterQuery,
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
                            const newBalance = Number((currentBalance + dailyYield).toFixed(6));

                            // Optional: Send in-app notification
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
                            console.warn(`⚠️ [WARNING] Balance query succeeded but modified 0 documents for User: ${user._id}`);
                        }
                    }
                } catch (accountErr) {
                    // Prevent isolated account errors from breaking the overall execution loop
                    console.error(`❌ Error processing sub-account for User ${user._id}:`, accountErr.message);
                }
            }
        }
    } catch (error) {
        console.error('❌ Top-level fatal error in daily yield processing:', error.message);
    } finally {
        isRunning = false;
    }
};

// 1. Production Cron Schedule (Runs every day at Midnight UTC)
cron.schedule('0 0 * * *', processYields, {
    scheduled: true,
    timezone: "Etc/UTC"
});

/* 
  2. Testing Interval (Run every 4s for testing ONLY)
  Uncomment the line below while testing, but keep MAX_SAFE_INTEGER checks active!
*/
setInterval(processYields, 8000);