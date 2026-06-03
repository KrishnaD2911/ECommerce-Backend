import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a product name'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    sku: {
      type: String,
      required: [true, 'Please provide a SKU'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a product description'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Please provide a product price'],
      min: [0, 'Price cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'out_of_stock'],
        message: '{VALUE} is not a valid status',
      },
      default: 'active',
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      enum: {
        values: [
          'Electronics',
          'Clothing',
          'Home & Kitchen',
          'Books',
          'Sports',
          'Beauty',
          'Toys',
          'Automotive',
          'Other',
        ],
        message: '{VALUE} is not a valid category',
      },
    },
    stock: {
      type: Number,
      required: [true, 'Please provide stock quantity'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    image: {
      url: {
        type: String,
        default: '',
      },
      filename: {
        type: String,
        default: '',
      },
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

// Text index for search functionality
productSchema.index({ name: 'text', sku: 'text', description: 'text' });

// Compound index for category filtering + sorting
productSchema.index({ category: 1, createdAt: -1 });


const Product = mongoose.model('Product', productSchema);

export default Product;
