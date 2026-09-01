import dns from 'node:dns'; // 1. Import the DNS module
dns.setDefaultResultOrder('ipv4first'); // 2. Force Node v20 to use IPv4 first
dns.setServers(['1.1.1.1', '8.8.8.8']);
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors'; 
import userRoutes from './routes/userRoutes.js';
import authRoutes from './routes/oauthRoutes.js';
import cryptoRoutes from './routes/cryptoRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import './workers/investmentWorker.js';
import withdrawalRoutes from './routes/withdrawalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import accountAddressRoutes from './routes/accountAddressRoutes.js';

// Load environment variables
dotenv.config();

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
        family: 4 // 3. Double-enforce IPv4 explicitly for Mongoose
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
