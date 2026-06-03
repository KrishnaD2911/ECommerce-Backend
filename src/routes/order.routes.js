import express from 'express';
import { createOrder, getMyOrders, getOrders, updateOrderStatus } from '../controllers/order.controller.js';
import { protect, authorize } from '../middleware/auth.middleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createOrder)
  .get(protect, authorize('admin'), getOrders);

router.route('/:id/status')
  .put(protect, updateOrderStatus);

router.route('/myorders')
  .get(protect, getMyOrders);

export default router;
