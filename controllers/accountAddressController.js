import AccountAddress from '../models/UserAccountAddress.js';
import mongoose from 'mongoose';

// @desc    Create a new account configuration (Bank or Crypto)
// @route   POST /api/accounts/addresses
export const createAddress = async (req, res) => {
    try {
        const {
            type,
            asset,
            network,
            cryptoAddress,
            memo,
            bankName,
            accountName,
            accountNumber,
            routingNumber,
            paypalEmail // ◄ Destructure the new field
        } = req.body;

        // Form base payload object
        const addressData = {
            type,
            asset
        };

        // Enforce validations dynamically based on chosen channel type
        if (type === 'CRYPTO') {
            if (!network || !cryptoAddress) {
                return res.status(400).json({ success: false, message: 'Network and Crypto Address are required fields for CRYPTO type.' });
            }
            addressData.network = network;
            addressData.cryptoAddress = cryptoAddress;
            addressData.memo = memo || null;
        }

        else if (type === 'BANK') {
            if (!bankName || !accountName || !accountNumber) {
                return res.status(400).json({ success: false, message: 'Bank Name, Account Name, and Account Number are required fields for BANK type.' });
            }
            addressData.bankName = bankName;
            addressData.accountName = accountName;
            addressData.accountNumber = accountNumber;
            addressData.routingNumber = routingNumber || null;
        }

        else if (type === 'PAYPAL') { // ◄ New PayPal Validation Logic Block
            if (!paypalEmail) {
                return res.status(400).json({ success: false, message: 'PayPal Email is a required field for PAYPAL type.' });
            }
            addressData.paypalEmail = paypalEmail;
        }

        else {
            return res.status(400).json({ success: false, message: 'Invalid payment type option provided.' });
        }

        // Save entry to Database
        const newAddress = await AccountAddress.create(addressData);

        return res.status(201).json({
            success: true,
            data: newAddress
        });

    } catch (error) {
        // Handle Mongoose Unique Index Duplication conflicts cleanly (Error code 11000)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'This specific gateway configurations profile already exists dynamically in records.'
            });
        }

        return res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Get all account configurations
// @route   GET /api/accounts/addresses
export const getAllAddresses = async (req, res) => {
    try {
        const addresses = await AccountAddress.find({}).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, count: addresses.length, data: addresses });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single account configuration by ID
// @route   GET /api/accounts/addresses/:id
export const getAddressById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format' });
        }

        const address = await AccountAddress.findById(id);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Account address layout configuration not found' });
        }

        return res.status(200).json({ success: true, data: address });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update an account configuration by ID
// @route   PUT /api/accounts/addresses/:id
export const updateAddress = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format' });
        }

        // Clean values to preserve casing rule parameters if they are present in request payload
        if (req.body.type) req.body.type = req.body.type.toUpperCase();
        if (req.body.asset) req.body.asset = req.body.asset.toUpperCase();
        if (req.body.network) req.body.network = req.body.network.toUpperCase();

        const updatedAddress = await AccountAddress.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true } // runValidators triggers your conditional schema logic again
        );

        if (!updatedAddress) {
            return res.status(404).json({ success: false, message: 'Account address configuration not found' });
        }

        return res.status(200).json({ success: true, message: 'Configuration successfully modified', data: updatedAddress });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Update failed: An identical route mapping setup already exists.' });
        }
        return res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete an account configuration by ID
// @route   DELETE /api/accounts/addresses/:id
export const deleteAddress = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid ID format' });
        }

        const deletedAddress = await AccountAddress.findByIdAndDelete(id);
        if (!deletedAddress) {
            return res.status(404).json({ success: false, message: 'Account address configuration target not found' });
        }

        return res.status(200).json({ success: true, message: 'Configuration removed from system nodes successfully.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
