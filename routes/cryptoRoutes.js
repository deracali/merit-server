import express from 'express';
import {
    addCryptoAsset,
    getAllCryptoAssets,
    getCryptoAssetById,
    updateCryptoAsset,
    deleteCryptoAsset
} from '../controllers/CryptoController.js';

const router = express.Router();

// Collection routes
router.route('/')
    .get(getAllCryptoAssets)   // GET /api/crypto
    .post(addCryptoAsset);     // POST /api/crypto

// Document target routes
router.route('/:cryptoId')
    .get(getCryptoAssetById)    // GET /api/crypto/:cryptoId
    .put(updateCryptoAsset)
    .delete(deleteCryptoAsset); // DELETE /api/crypto/:cryptoId

export default router;
