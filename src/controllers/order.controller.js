import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import GiftCard from '../models/giftCard.model.js';
import { asyncHandler, ErrorHandler } from '../middleware/error.middleware.js';

/**
 * @desc    Create new order
 * @route   POST /api/v1/orders
 * @access  Private
 */
export const createOrder = asyncHandler(async (req, res, next) => {
  const { items, totalPrice, giftCardCode } = req.body;

  if (!items || items.length === 0) {
    return next(new ErrorHandler('No order items', 400));
  }

  let finalPrice = totalPrice;
  let discountAmount = 0;
  let appliedCode = null;

  // Handle gift card redemption
  if (giftCardCode) {
    const giftCard = await GiftCard.findOne({ code: giftCardCode.toUpperCase(), isDeleted: false });

    if (!giftCard) {
      return next(new ErrorHandler('Invalid gift card code', 404));
    }

    if (giftCard.status !== 'active') {
      return next(new ErrorHandler(`This gift card is ${giftCard.status}`, 400));
    }

    // Restrict purchased gift cards to the recipient's email
    if (giftCard.isPurchased && giftCard.recipientEmail) {
      if (req.user.email.toLowerCase() !== giftCard.recipientEmail.toLowerCase()) {
        return next(new ErrorHandler('This gift card can only be used by its intended recipient', 403));
      }
    }

    if (giftCard.isPurchased && giftCard.balance <= 0) {
      return next(new ErrorHandler('This gift card has no remaining balance', 400));
    }

    if (giftCard.activationDate && new Date() < new Date(giftCard.activationDate)) {
      return next(new ErrorHandler('The provided gift card is not active yet', 400));
    }

    if (giftCard.expiryDate && new Date(giftCard.expiryDate) < new Date()) {
      giftCard.status = 'expired';
      await giftCard.save();
      return next(new ErrorHandler('This gift card has expired', 400));
    }

    if (giftCard.maxUsage !== null && giftCard.usageCount >= giftCard.maxUsage) {
      return next(new ErrorHandler('This gift card has reached its maximum usage limit', 400));
    }

    // Check minimum cart value
    if (giftCard.minCartValue > 0 && totalPrice < giftCard.minCartValue) {
      return next(
        new ErrorHandler(
          `Minimum cart value of ₹${giftCard.minCartValue} required to use this gift card.`,
          400
        )
      );
    }

    // Cart value must be strictly greater than the initial value of the gift card (Only for admin-created promo codes)
    if (!giftCard.isPurchased && totalPrice <= giftCard.amount) {
      return next(
        new ErrorHandler(
          `Cart value must be greater than the initial value of the gift card (₹${giftCard.amount}).`,
          400
        )
      );
    }

    // Calculate discount
    if (giftCard.isPurchased) {
      discountAmount = Math.min(giftCard.balance, totalPrice);
      giftCard.balance -= discountAmount;
    } else {
      discountAmount = Math.min(giftCard.amount, totalPrice);
      // Admin cards don't deduct balance
    }

    finalPrice = totalPrice - discountAmount;
    appliedCode = giftCard.code;

    // Increment usage
    giftCard.usageCount += 1;
    
    giftCard.usedBy.push({
      user: req.user._id,
      amountUsed: discountAmount,
    });

    if ((giftCard.isPurchased && giftCard.balance <= 0) || (giftCard.maxUsage !== null && giftCard.usageCount >= giftCard.maxUsage)) {
      giftCard.status = 'redeemed';
    }

    await giftCard.save();
  }

  // Create order
  const order = await Order.create({
    user: req.user._id,
    items,
    totalPrice: finalPrice,
    giftCardCode: appliedCode,
    discountAmount,
    status: 'completed',
  });

  // Deduct stock
  for (const item of items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.stock -= item.quantity;
      if (product.stock <= 0) {
        product.stock = 0;
        product.status = 'out_of_stock';
      }
      await product.save();
    }
  }

  import('../socket.js').then(({ getIO }) => {
    try {
      getIO().emit('products_updated');
    } catch (e) {
      console.log('Socket not ready');
    }
  });

  res.status(201).json({
    success: true,
    order,
  });
});

/**
 * @desc    Get logged in user orders
 * @route   GET /api/v1/orders/myorders
 * @access  Private
 */
export const getMyOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

/**
 * @desc    Get all orders
 * @route   GET /api/v1/orders
 * @access  Private/Admin
 */
export const getOrders = asyncHandler(async (req, res, next) => {
  const orders = await Order.find().populate('user', 'name email').sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    orders,
  });
});

/**
 * @desc    Update order status
 * @route   PUT /api/v1/orders/:id/status
 * @access  Private (User can request return/exchange, Admin can approve)
 */
export const updateOrderStatus = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);

  if (!order) {
    return next(new ErrorHandler('Order not found', 404));
  }

  // Ensure users can only update their own orders unless they are an admin
  if (req.user.role !== 'admin' && order.user.toString() !== req.user._id.toString()) {
    return next(new ErrorHandler('Not authorized to update this order', 403));
  }

  order.status = status;
  await order.save();

  import('../socket.js').then(({ getIO }) => {
    try {
      getIO().emit('orders_updated');
    } catch (e) {
      console.log('Socket not ready');
    }
  });

  res.status(200).json({
    success: true,
    order,
  });
});
