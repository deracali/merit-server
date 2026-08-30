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

// Helper to determine active tier based on current balance
const getTierForBalance = (balance) => {
    return TIERS.find(tier => balance >= tier.min && balance <= tier.max) || null;
};

cron.schedule('0 0 * * *', async () => {
    console.log('⏳ Processing daily compounding crypto yield distributions...');
    try {
        const users = await User.find({ 'cryptoAccounts.0': { $exists: true } });

        for (let user of users) {
            for (let cryptoAccount of user.cryptoAccounts) {
                // Fetch latest balance (includes previously compounded yields)
                const currentBalance = cryptoAccount.balance;
                const matchedTier = getTierForBalance(currentBalance);

                // Process only if balance meets minimum Tier 1 requirement ($20)
                if (matchedTier) {
                    // Calculate yield on the full updated balance
                    const rawYield = currentBalance * matchedTier.rate;
                    const dailyYield = Number(rawYield.toFixed(6));
                    const yieldPercentageDisplay = (matchedTier.rate * 100).toFixed(1);
                    
                    const timestamp = Date.now();
                    const uniqueRef = `YIELD-${cryptoAccount.coinName}-${user._id}-${timestamp}-${Math.floor(Math.random() * 10000)}`;

                    // Atomic update: increment balance and push history record
                    const updateResult = await User.updateOne(
                        { _id: user._id, "cryptoAccounts._id": cryptoAccount._id },
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

                        await createNotificationHelper(
                            user._id,
                            'Daily Yield Disbursed! 🚀',
                            `Your balance grew! You earned +${dailyYield} ${cryptoAccount.coinName} (${yieldPercentageDisplay}% ${matchedTier.name}). New balance: ${newBalance} ${cryptoAccount.coinName}.`,
                            'success'
                        );

                        console.log(`✅ ${matchedTier.name} yield (+${dailyYield}) credited for User: ${user._id}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Error processing daily compounding yields:', error.message);
    }
}, {
    scheduled: true,
    timezone: "UTC"
});