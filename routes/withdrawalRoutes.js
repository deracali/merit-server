import express from 'express';
import {
    requestWithdrawal,
    finalizeWithdrawal,
    getUserWithdrawals,
    getRecentActivity,
    getAllWithdrawals
} from '../controllers/withdrawalController.js';

const router = express.Router();

router.post('/request', requestWithdrawal);          // POST /api/withdrawals/request
router.put('/:id/finalize', finalizeWithdrawal);     // PUT /api/withdrawals/:id/finalize
router.get('/:userId', getUserWithdrawals);     // GET /api/withdrawals/user/:userId
router.get('/:userId/recent-activities', getRecentActivity);
router.get('/', getAllWithdrawals);

export default router;
