import 'dotenv/config'; // Loads .env BEFORE any other module imports execute
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['1.1.1.1', '8.8.8.8']);

// ====== Debug Logs ======
console.log('--------------------------------------------------');
console.log('📂 Working Directory:', process.cwd());
console.log('🔑 MONGO_URI value:', process.env.MONGO_URI);
console.log('--------------------------------------------------');

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors'; 
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/oauthRoutes.js';
import cryptoRoutes from './routes/cryptoRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import './workers/investmentWorker.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import accountAddressRoutes from './routes/accountAddressRoutes.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Enable CORS globally for all origins (*)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON payloads
app.use(express.json());

// Basic Route for Testing
app.get('/', (req, res) => {
    res.json({ message: 'ES6 Server is up and running!' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/accounts', accountAddressRoutes);

// Connect to MongoDB and Start Server
mongoose
    .connect(process.env.MONGO_URI, {
        family: 4
    })
    .then(() => {
        console.log('🚀 Connected to MongoDB successfully!');

        app.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        process.exit(1);
    });