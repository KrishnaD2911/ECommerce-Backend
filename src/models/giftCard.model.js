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
      required: true,
      min: [0, 'Balance cannot be negative'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'redeemed', 'expired'],
      default: 'active',
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

// Middleware to automatically set balance to amount if not provided on creation
giftCardSchema.pre('validate', function (next) {
  if (this.isNew && this.balance === undefined) {
    this.balance = this.amount;
  }
  next();
});

const GiftCard = mongoose.model('GiftCard', giftCardSchema);

export default GiftCard;
