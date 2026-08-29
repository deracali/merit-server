import express from 'express';
import { buyCrypto, sellCrypto, getUserTrades } from '../controllers/TradeController.js';

const router = express.Router();

router.post('/buy', buyCrypto);
router.post('/sell', sellCrypto);
router.get('/user/:userId', getUserTrades);

export default router;
