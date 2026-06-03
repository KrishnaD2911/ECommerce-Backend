import GiftCard from '../models/giftCard.model.js';
import { asyncHandler, ErrorHandler } from '../middleware/error.middleware.js';
import APIFeatures from '../utils/apiFeatures.js';
import crypto from 'crypto';

/**
 * Generate a random gift card code
 */
const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'GIFT-';
  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  result += '-';
  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

/**
 * @desc    Create new gift card
 * @route   POST /api/v1/giftcards
 * @access  Private/Admin
 */
export const createGiftCard = asyncHandler(async (req, res, next) => {
  req.body.createdBy = req.user.id;
  
  if (!req.body.code) {
    let isUnique = false;
    let newCode = '';
    while (!isUnique) {
      newCode = generateCode();
      const existing = await GiftCard.findOne({ code: newCode });
      if (!existing) isUnique = true;
    }
    req.body.code = newCode;
  }

  const giftCard = await GiftCard.create(req.body);

  res.status(201).json({
    success: true,
    data: giftCard,
  });
});

/**
 * @desc    Get all gift cards (Admin)
 * @route   GET /api/v1/giftcards
 * @access  Private/Admin
 */
export const getGiftCards = asyncHandler(async (req, res, next) => {
  // Only get non-deleted gift cards
  const filter = { isDeleted: false };
  
  const resPerPage = Number(req.query.limit) || 12;
  const apiFeatures = new APIFeatures(GiftCard.find(filter).populate('createdBy', 'name email'), req.query)
    .search()
    .filter()
    .sort()
    .paginate(resPerPage);

  const giftCards = await apiFeatures.query;
  const filteredCount = await GiftCard.countDocuments(apiFeatures.query.getFilter());
  const totalCount = await GiftCard.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: giftCards.length,
    totalCount,
    filteredCount,
    resPerPage,
    totalPages: Math.ceil(filteredCount / resPerPage),
    currentPage: Number(req.query.page) || 1,
    data: giftCards,
  });
});

/**
 * @desc    Get single gift card
 * @route   GET /api/v1/giftcards/:id
 * @access  Private/Admin
 */
export const getGiftCardById = asyncHandler(async (req, res, next) => {
  const giftCard = await GiftCard.findOne({ _id: req.params.id, isDeleted: false }).populate('createdBy', 'name email');

  if (!giftCard) {
    return next(new ErrorHandler('Gift card not found', 404));
  }

  res.status(200).json({
    success: true,
    data: giftCard,
  });
});

/**
 * @desc    Update gift card
 * @route   PUT /api/v1/giftcards/:id
 * @access  Private/Admin
 */
export const updateGiftCard = asyncHandler(async (req, res, next) => {
  let giftCard = await GiftCard.findOne({ _id: req.params.id, isDeleted: false });

  if (!giftCard) {
    return next(new ErrorHandler('Gift card not found', 404));
  }

  // Admin shouldn't directly modify code after creation to avoid issues, but we can allow it if needed.
  // For safety, let's remove code from req.body if present to prevent accidental changes
  if (req.body.code && req.body.code !== giftCard.code) {
    const existing = await GiftCard.findOne({ code: req.body.code, _id: { $ne: giftCard._id } });
    if (existing) {
      return next(new ErrorHandler('Gift card code already exists', 400));
    }
  }

  // Auto-update status if limits reached
  if (req.body.balance !== undefined && req.body.balance <= 0) {
    req.body.status = 'redeemed';
  } else if (req.body.maxUsage !== undefined && req.body.maxUsage !== null && giftCard.usageCount >= req.body.maxUsage) {
    req.body.status = 'redeemed';
  }

  giftCard = await GiftCard.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: giftCard,
  });
});

/**
 * @desc    Delete gift card (Soft Delete)
 * @route   DELETE /api/v1/giftcards/:id
 * @access  Private/Admin
 */
export const deleteGiftCard = asyncHandler(async (req, res, next) => {
  const giftCard = await GiftCard.findById(req.params.id);

  if (!giftCard) {
    return next(new ErrorHandler('Gift card not found', 404));
  }

  giftCard.isDeleted = true;
  await giftCard.save();

  res.status(200).json({
    success: true,
    message: 'Gift card deleted successfully',
  });
});

/**
 * @desc    Bulk update status
 * @route   POST /api/v1/giftcards/bulk-status-update
 * @access  Private/Admin
 */
export const bulkStatusUpdate = asyncHandler(async (req, res, next) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler('Please provide an array of gift card IDs', 400));
  }

  const validStatuses = ['active', 'inactive', 'redeemed', 'expired'];
  if (!status || !validStatuses.includes(status)) {
    return next(new ErrorHandler('Please provide a valid status', 400));
  }

  const result = await GiftCard.updateMany(
    { _id: { $in: ids }, isDeleted: false },
    { $set: { status } }
  );

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} gift card(s) status updated successfully`,
    modifiedCount: result.modifiedCount,
  });
});

/**
 * @desc    Apply / validate a gift card code (Public - authenticated users)
 * @route   POST /api/v1/giftcards/apply
 * @access  Private (any logged-in user)
 */
export const applyGiftCard = asyncHandler(async (req, res, next) => {
  const { code, cartTotal } = req.body;

  if (!code) {
    return next(new ErrorHandler('Please provide a gift card code', 400));
  }

  const giftCard = await GiftCard.findOne({ code: code.toUpperCase(), isDeleted: false });

  if (!giftCard) {
    return next(new ErrorHandler('Invalid gift card code', 404));
  }

  if (giftCard.status !== 'active') {
    return next(new ErrorHandler(`This gift card is ${giftCard.status}`, 400));
  }

  if (giftCard.balance <= 0) {
    return next(new ErrorHandler('This gift card has no remaining balance', 400));
  }

  // Check expiry
  if (giftCard.expiryDate && new Date(giftCard.expiryDate) < new Date()) {
    giftCard.status = 'expired';
    await giftCard.save();
    return next(new ErrorHandler('This gift card has expired', 400));
  }

  // Check usage limit
  if (giftCard.maxUsage !== null && giftCard.usageCount >= giftCard.maxUsage) {
    return next(new ErrorHandler('This gift card has reached its maximum usage limit', 400));
  }

  // Check minimum cart value
  if (giftCard.minCartValue > 0 && cartTotal < giftCard.minCartValue) {
    return next(
      new ErrorHandler(
        `Minimum cart value of ₹${giftCard.minCartValue} required to use this gift card. Your cart total is ₹${cartTotal}.`,
        400
      )
    );
  }

  // Calculate the discount (capped at the card's balance or the cart total, whichever is lower)
  const discount = Math.min(giftCard.balance, cartTotal || Infinity);

  res.status(200).json({
    success: true,
    data: {
      code: giftCard.code,
      balance: giftCard.balance,
      discount,
      minCartValue: giftCard.minCartValue,
    },
  });
});

/**
 * @desc    Purchase a gift card (Customer)
 * @route   POST /api/v1/giftcards/purchase
 * @access  Private (any logged-in user)
 */
export const purchaseGiftCard = asyncHandler(async (req, res, next) => {
  const { amount, recipientName, recipientEmail, senderName, message } = req.body;

  if (!amount || amount <= 0) {
    return next(new ErrorHandler('Please provide a valid amount', 400));
  }

  if (!recipientName || !recipientEmail) {
    return next(new ErrorHandler('Recipient name and email are required', 400));
  }

  // Generate unique code
  let isUnique = false;
  let newCode = '';
  while (!isUnique) {
    newCode = generateCode();
    const existing = await GiftCard.findOne({ code: newCode });
    if (!existing) isUnique = true;
  }

  // Set expiry to 1 year from now
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  const giftCard = await GiftCard.create({
    code: newCode,
    amount,
    balance: amount,
    status: 'active',
    expiryDate,
    maxUsage: null,
    createdBy: req.user.id,
    isPurchased: true,
    recipientName,
    recipientEmail,
    senderName: senderName || req.user.name || 'A Friend',
    message: message || '',
  });

  res.status(201).json({
    success: true,
    data: giftCard,
  });
});

/**
 * @desc    Get gift card analytics (Admin)
 * @route   GET /api/v1/giftcards/stats
 * @access  Private/Admin
 */
export const getGiftCardStats = asyncHandler(async (req, res, next) => {
  const stats = await GiftCard.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        totalCards: { $sum: 1 },
        totalActiveCards: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        totalRedeemedCards: {
          $sum: { $cond: [{ $eq: ['$status', 'redeemed'] }, 1, 0] },
        },
        totalExpiredCards: {
          $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] },
        },
        totalLiability: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, '$balance', 0] },
        },
        totalIssuedValue: { $sum: '$amount' },
        totalRedeemedValue: {
          $sum: { $subtract: ['$amount', '$balance'] },
        },
        totalPurchasedCards: {
          $sum: { $cond: [{ $eq: ['$isPurchased', true] }, 1, 0] },
        },
        totalAdminCreatedCards: {
          $sum: { $cond: [{ $ne: ['$isPurchased', true] }, 1, 0] },
        },
      },
    },
  ]);

  res.status(200).json({
    success: true,
    data: stats[0] || {
      totalCards: 0,
      totalActiveCards: 0,
      totalRedeemedCards: 0,
      totalExpiredCards: 0,
      totalLiability: 0,
      totalIssuedValue: 0,
      totalRedeemedValue: 0,
      totalPurchasedCards: 0,
      totalAdminCreatedCards: 0,
    },
  });
});

/**
 * @desc    Export gift cards as CSV (Admin)
 * @route   GET /api/v1/giftcards/export
 * @access  Private/Admin
 */
export const exportGiftCardsCSV = asyncHandler(async (req, res, next) => {
  const giftCards = await GiftCard.find({ isDeleted: false })
    .populate('createdBy', 'name email')
    .sort('-createdAt');

  const headers = [
    'Code',
    'Initial Amount',
    'Balance',
    'Status',
    'Type',
    'Expiry Date',
    'Max Usage',
    'Usage Count',
    'Min Cart Value',
    'Recipient Name',
    'Recipient Email',
    'Sender Name',
    'Message',
    'Created By',
    'Created At',
  ];

  const rows = giftCards.map((card) => [
    card.code,
    card.amount,
    card.balance,
    card.status,
    card.isPurchased ? 'Purchased' : 'Admin Created',
    card.expiryDate ? new Date(card.expiryDate).toLocaleDateString('en-IN') : 'Never',
    card.maxUsage !== null ? card.maxUsage : 'Unlimited',
    card.usageCount,
    card.minCartValue || 0,
    card.recipientName || '',
    card.recipientEmail || '',
    card.senderName || '',
    (card.message || '').replace(/"/g, '""'),
    card.createdBy ? `${card.createdBy.name} (${card.createdBy.email})` : 'N/A',
    new Date(card.createdAt).toLocaleDateString('en-IN'),
  ]);

  let csv = headers.join(',') + '\n';
  rows.forEach((row) => {
    csv += row.map((val) => `"${val}"`).join(',') + '\n';
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=gift-cards-${Date.now()}.csv`);
  res.status(200).send(csv);
});

/**
 * @desc    Get logged in user's gift cards (received or purchased)
 * @route   GET /api/v1/giftcards/my
 * @access  Private (any logged-in user)
 */
export const getMyGiftCards = asyncHandler(async (req, res, next) => {
  const giftCards = await GiftCard.find({
    isDeleted: false,
    $or: [
      { recipientEmail: req.user.email },
      { createdBy: req.user.id }
    ]
  }).sort('-createdAt');

  res.status(200).json({
    success: true,
    data: giftCards,
  });
});
