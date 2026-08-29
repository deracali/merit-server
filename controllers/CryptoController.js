import Crypto from '../models/Crypto.js';

// @desc    Add a new cryptocurrency asset with standard rates
// @route   POST /api/crypto
export const addCryptoAsset = async (req, res) => {
    console.log('--- Incoming Request Debug ---');
    console.log('Headers:', req.headers['content-type']);
    console.log('Request Body:', req.body);

    try {
        // 1. Normalize input: wrap single object into an array if needed
        const assetsArray = Array.isArray(req.body) ? req.body : [req.body];

        if (!assetsArray.length) {
            return res.status(400).json({ success: false, message: 'Request body cannot be empty.' });
        }

        const createdAssets = [];
        const skippedAssets = [];

        // 2. Loop through each asset in the list
        for (const asset of assetsArray) {
            const { name, symbol, rates, imageIcon, isActive } = asset;

            if (!name || !symbol) {
                skippedAssets.push({ item: asset, reason: 'Missing name or symbol' });
                continue;
            }

            const normalizedSymbol = symbol.trim().toUpperCase();
            const trimmedName = name.trim();

            // Check if asset already exists in DB
            const assetExists = await Crypto.findOne({
                $or: [
                    { symbol: normalizedSymbol },
                    { name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } }
                ]
            });

            if (assetExists) {
                skippedAssets.push({ symbol: normalizedSymbol, reason: 'Asset already exists' });
                continue;
            }

            // Create new asset
            const newAsset = await Crypto.create({
                name: trimmedName,
                symbol: normalizedSymbol,
                rates: rates || {},
                imageIcon,
                isActive: isActive !== undefined ? isActive : true
            });

            createdAssets.push(newAsset);
        }

        console.log(`✅ Processed: ${createdAssets.length} created, ${skippedAssets.length} skipped.`);

        return res.status(201).json({
            success: true,
            message: `Successfully processed assets. (${createdAssets.length} added, ${skippedAssets.length} skipped)`,
            data: createdAssets,
            skipped: skippedAssets
        });

    } catch (error) {
        console.error('❌ Server Error in addCryptoAsset:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};



// @desc    Get all active cryptocurrencies with their rates
// @route   GET /api/crypto
export const getAllCryptoAssets = async (req, res) => {
    try {
        const assets = await Crypto.find({ isActive: true });
        res.status(200).json({ success: true, count: assets.length, data: assets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get a single cryptocurrency asset by ID
// @route   GET /api/crypto/:cryptoId
export const getCryptoAssetById = async (req, res) => {
    try {
        const { cryptoId } = req.params;
        const asset = await Crypto.findById(cryptoId);

        if (!asset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        res.status(200).json({ success: true, data: asset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete a cryptocurrency configuration completely
// @route   DELETE /api/crypto/:cryptoId
export const deleteCryptoAsset = async (req, res) => {
    try {
        const { cryptoId } = req.params;
        const deletedAsset = await Crypto.findByIdAndDelete(cryptoId);

        if (!deletedAsset) {
            return res.status(404).json({ success: false, message: 'Asset not found' });
        }

        res.status(200).json({ success: true, message: 'Crypto asset deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// @desc    Update crypto asset information or multi-currency exchange rates
// @route   PUT /api/crypto/:cryptoId
export const updateCryptoAsset = async (req, res) => {
    try {
        const { cryptoId } = req.params;

        // Using $set allows partial updates (e.g., updating just the EUR rate without altering USD)
        const updatedAsset = await Crypto.findByIdAndUpdate(
            cryptoId,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedAsset) {
            return res.status(404).json({ success: false, message: 'Crypto asset configuration not found' });
        }

        res.status(200).json({ success: true, message: 'Market currency rates refreshed', data: updatedAsset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
