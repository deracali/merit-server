import express from 'express';
import {
    registerUser,
    loginUser,
    getAllUsers,
    getUserById,
    updateUser,    // Add this
    deleteUser,    // Add this
    addBankAccount,
    addCryptoAccount,
    createTransaction,
    setTransactionPin,
    getMonthlyTransactions,
    updateTransactionStatus
} from '../controllers/UserController.js';

const router = express.Router();

// Fetching Data Routes
router.get('/', getAllUsers);
router.get('/:userId', getUserById);
router.get('/:userId/monthly-transactions', getMonthlyTransactions);
// Authentication Routes
router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/:userId/set-pin', setTransactionPin);
// Profile Alteration & Removal Routes
router.put('/:userId', updateUser);      // PUT /api/users/:userId
router.delete('/:userId', deleteUser);   // DELETE /api/users/:userId
router.patch('/:userId/transactions/:transactionId/status', updateTransactionStatus);
// Account Configuration Sub-routes
router.post('/:userId/bank-accounts', addBankAccount);
router.post('/:userId/crypto-accounts', addCryptoAccount);
router.post('/:userId/transactions', createTransaction);

export default router;
