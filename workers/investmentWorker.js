import cron from 'node-cron';
import User from '../models/User.js';
import { createNotificationHelper } from '../controllers/notificationController.js';

// Changed schedule to '0 0 * * *' to run once every 24 hours at midnight
cron.schedule('0 0 * * *', async () => {
    console.log('⏳ Running 10% daily crypto investment yield calculator...');
    try {
        const users = await User.find({ 'cryptoAccounts.0': { $exists: true } });

        for (let user of users) {
            for (let i = 0; i < user.cryptoAccounts.length; i++) {
                const cryptoAccount = user.cryptoAccounts[i];
                const currentBalance = cryptoAccount.balance;

                if (currentBalance > 0) {
                    const dailyYield = Number((currentBalance * 0.10).toFixed(6));
                    const timestamp = Date.now();
                    const uniqueRef = `YIELD-${cryptoAccount.coinName}-${user._id}-${timestamp}-${Math.floor(Math.random() * 10000)}`;

                    // Use atomic update to prevent race conditions and version errors
                    await User.updateOne(
                        { _id: user._id, "cryptoAccounts._id": cryptoAccount._id },
                        {
                            $inc: { [`cryptoAccounts.${i}.balance`]: dailyYield },
                            $push: {
                                balanceHistory: {
                                    type: 'credit',
                                    amount: dailyYield,
                                    currency: cryptoAccount.coinName,
                                    status: 'completed',
                                    description: `Daily 10% interest yield earned on ${cryptoAccount.coinName}`,
                                    reference: uniqueRef
                                }
                            }
                        }
                    );

                    // Trigger Notification
                    await createNotificationHelper(
                        user._id,
                        'Daily Yield Disbursed! 🚀',
                        `Your portfolio grew! You've been credited with +${dailyYield} ${cryptoAccount.coinName}.`,
                        'success'
                    );

                    console.log(`✅ Daily yield processed successfully for User ID: ${user._id}`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error processing daily investment yields:', error.message);
    }
});