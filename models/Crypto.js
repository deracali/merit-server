import mongoose from 'mongoose';

const CryptoSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        symbol: { type: String, required: true, unique: true, uppercase: true },

        // Dynamic multi-currency valuation rates
        rates: {
            usd: { type: Number, required: true, default: 0 },
            eur: { type: Number, required: true, default: 0 },
            gbp: { type: Number, required: true, default: 0 },
            cad: { type: Number, default: 0 },
            aud: { type: Number, default: 0 }
        },

        isActive: { type: Boolean, default: true },
        imageIcon: { type: String }
    },
    { timestamps: true }
);

const Crypto = mongoose.model('Crypto', CryptoSchema);
export default Crypto;
