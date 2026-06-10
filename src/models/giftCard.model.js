import mongoose from 'mongoose';

const giftCardSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Please provide a gift card code'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please provide the initial gift card amount'],
      min: [0, 'Amount cannot be negative'],
    },
    balance: {
      type: Number,
      default: null,
      min: [0, 'Balance cannot be negative'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'redeemed', 'expired', 'pending'],
      default: 'active',
    },
    activationDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    maxUsage: {
      type: Number,
      default: null, // null means unlimited uses until balance is 0
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.ObjectId,
          ref: 'User',
        },
        amountUsed: Number,
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    minCartValue: {
      type: Number,
      default: 0, // 0 means no minimum
      min: [0, 'Minimum cart value cannot be negative'],
    },
    isPurchased: {
      type: Boolean,
      default: false,
    },
    recipientName: {
      type: String,
      trim: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
    },
    senderName: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


const GiftCard = mongoose.model('GiftCard', giftCardSchema);

export default GiftCard;
