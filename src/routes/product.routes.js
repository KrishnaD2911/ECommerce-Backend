import express from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  restoreProduct,
  bulkDeleteProducts,
  bulkPriceUpdate,
  bulkStatusUpdate,
  bulkStockUpdate,
  getProductStats,
} from '../controllers/product.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';
import { uploadSingle } from '../middleware/upload.middleware.js';
import {
  createProductValidation,
  updateProductValidation,
} from '../validations/product.validation.js';

const router = express.Router();

// Admin Stats Route - Must be before /:id routes to avoid being caught by them
router.get(
  '/stats',
  protect,
  authorize('admin'),
  getProductStats
);

// Bulk Admin Routes
router.post(
  '/bulk-delete',
  protect,
  authorize('admin'),
  bulkDeleteProducts
);

router.post(
  '/bulk-price-update',
  protect,
  authorize('admin'),
  bulkPriceUpdate
);

router.post(
  '/bulk-status-update',
  protect,
  authorize('admin'),
  bulkStatusUpdate
);

router.post(
  '/bulk-stock-update',
  protect,
  authorize('admin'),
  bulkStockUpdate
);

// Public Routes
router.route('/')
  .get(getProducts)
  .post(
    protect,
    authorize('admin'),
    uploadSingle,
    createProductValidation,
    createProduct
  );

// Individual Product Admin Routes
router.route('/:id')
  .get(getProduct)
  .put(
    protect,
    authorize('admin'),
    uploadSingle,
    updateProductValidation,
    updateProduct
  )
  .delete(
    protect,
    authorize('admin'),
    deleteProduct
  );

router.put(
  '/:id/restore',
  protect,
  authorize('admin'),
  restoreProduct
);

export default router;
