import express from 'express';
import {
    createAddress,
    getAllAddresses,
    getAddressById,
    updateAddress,
    deleteAddress
} from '../controllers/accountAddressController.js';

const router = express.Router();

// Base collection mapping route handlers
router.route('/address')
    .get(getAllAddresses)
    .post(createAddress);

// Resource specific instance mapping route handlers
router.route('/:id')
    .get(getAddressById)
    .put(updateAddress)
    .delete(deleteAddress);

export default router;
