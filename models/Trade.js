import mongoose from 'mongoose';

const TradeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        cryptoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Crypto',
            required: true
        },
        type: {
            type: String,
            enum: ['buy', 'sell'],
            required: true
        },
        cryptoSymbol: { type: String, required: true, uppercase: true }, // e.g., "BTC"
        fiatCurrency: { type: String, enum: ['usd', 'eur', 'gbp', 'cad', 'aud'], required: true }, // Currency used for payment
        cryptoAmount: { type: Number, required: true, min: 0.000001 }, // Amount of crypto bought/sold
        fiatAmount: { type: Number, required: true, min: 0.01 }, // Total cost/yield in fiat
        rateApplied: { type: Number, required: true }, // The price of the crypto at the moment of execution
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending' // Changed default from 'completed' to 'pending'
        }
    },
    { timestamps: true }
);

const Trade = mongoose.model('Trade', TradeSchema);
export default Trade;
