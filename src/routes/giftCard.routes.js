import express from 'express';
import {
  createGiftCard,
  getGiftCards,
  getGiftCardById,
  updateGiftCard,
  deleteGiftCard,
  bulkStatusUpdate,
  applyGiftCard,
  purchaseGiftCard,
  getGiftCardStats,
  exportGiftCardsCSV,
  getMyGiftCards,
} from '../controllers/giftCard.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes (authenticated users only, no admin required)
router.get('/my', protect, getMyGiftCards);
router.post('/apply', protect, applyGiftCard);
router.post('/purchase', protect, purchaseGiftCard);

// Admin-only routes below
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getGiftCardStats);
router.get('/export', exportGiftCardsCSV);
router.post('/bulk-status-update', bulkStatusUpdate);

router.route('/')
  .get(getGiftCards)
  .post(createGiftCard);

router.route('/:id')
  .get(getGiftCardById)
  .put(updateGiftCard)
  .delete(deleteGiftCard);

export default router;
