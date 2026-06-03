import { validationResult } from 'express-validator';
import Product from '../models/product.model.js';
import ApiFeatures from '../utils/apiFeatures.js';
import { asyncHandler, ErrorHandler } from '../middleware/error.middleware.js';
import { getIO } from '../socket.js';

const withUploadedImage = (body, file) => {
  if (!file) return body;

  return {
    ...body,
    image: {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
    },
  };
};

/**
 * @desc    Get all products with search, filter, sort, pagination
 * @route   GET /api/v1/products
 * @access  Public
 */
export const getProducts = asyncHandler(async (req, res) => {
  // Count total matching documents (before pagination) for frontend pagination info
  const countQuery = new ApiFeatures(Product.find(), req.query)
    .search()
    .filter();
  const totalProducts = await Product.countDocuments(countQuery.query.getFilter());

  // Build paginated query
  const features = new ApiFeatures(Product.find(), req.query)
    .search()
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query;

  const limit = parseInt(req.query.limit, 10) || 12;
  const page = parseInt(req.query.page, 10) || 1;

  res.status(200).json({
    success: true,
    count: products.length,
    totalProducts,
    page,
    pages: Math.ceil(totalProducts / limit) || 1,
    products,
  });
});

/**
 * @desc    Get single product by ID (excluding soft-deleted)
 * @route   GET /api/v1/products/:id
 * @access  Public
 */
export const getProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findOne({ _id: req.params.id, isDeleted: false });

  if (!product) {
    return next(new ErrorHandler('Product not found or has been deleted', 404));
  }

  res.status(200).json({
    success: true,
    product,
  });
});

/**
 * @desc    Create a new product
 * @route   POST /api/v1/products
 * @access  Private/Admin
 */
export const createProduct = asyncHandler(async (req, res, next) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorHandler(errors.array().map((e) => e.msg).join('. '), 400));
  }

  const productData = { ...req.body };
  if (productData.stock !== undefined) {
    if (Number(productData.stock) <= 0) {
      productData.stock = 0;
      productData.status = 'out_of_stock';
    } else if (productData.status === 'out_of_stock') {
      productData.status = 'active';
    }
  }

  const product = await Product.create(withUploadedImage(productData, req.file));

  getIO().emit('products_updated');

  res.status(201).json({
    success: true,
    product,
  });
});

/**
 * @desc    Update a product
 * @route   PUT /api/v1/products/:id
 * @access  Private/Admin
 */
export const updateProduct = asyncHandler(async (req, res, next) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorHandler(errors.array().map((e) => e.msg).join('. '), 400));
  }

  let product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler('Product not found', 404));
  }

  const productData = { ...req.body };
  if (productData.stock !== undefined) {
    if (Number(productData.stock) <= 0) {
      productData.stock = 0;
      productData.status = 'out_of_stock';
    } else if (product.status === 'out_of_stock' && productData.status === undefined) {
      productData.status = 'active';
    }
  }

  product = await Product.findByIdAndUpdate(req.params.id, withUploadedImage(productData, req.file), {
    new: true,
    runValidators: true,
  });

  getIO().emit('products_updated');

  res.status(200).json({
    success: true,
    product,
  });
});

/**
 * @desc    Delete a product (Soft Delete)
 * @route   DELETE /api/v1/products/:id
 * @access  Private/Admin
 */
export const deleteProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler('Product not found', 404));
  }

  product.isDeleted = true;
  await product.save();

  getIO().emit('products_updated');

  res.status(200).json({
    success: true,
    message: 'Product soft deleted successfully',
  });
});

/**
 * @desc    Restore a soft-deleted product
 * @route   PUT /api/v1/products/:id/restore
 * @access  Private/Admin
 */
export const restoreProduct = asyncHandler(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new ErrorHandler('Product not found', 404));
  }

  product.isDeleted = false;
  await product.save();

  getIO().emit('products_updated');

  res.status(200).json({
    success: true,
    message: 'Product restored successfully',
    product,
  });
});

/**
 * @desc    Bulk delete products by IDs (Soft Delete)
 * @route   POST /api/v1/products/bulk-delete
 * @access  Private/Admin
 */
export const bulkDeleteProducts = asyncHandler(async (req, res, next) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler('Please provide an array of product IDs', 400));
  }

  const result = await Product.updateMany(
    { _id: { $in: ids } },
    { $set: { isDeleted: true } }
  );

  if (result.modifiedCount > 0) {
    getIO().emit('products_updated');
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) deleted successfully`,
    deletedCount: result.modifiedCount,
  });
});

/**
 * @desc    Bulk update products prices by percentage
 * @route   POST /api/v1/products/bulk-price-update
 * @access  Private/Admin
 */
export const bulkPriceUpdate = asyncHandler(async (req, res, next) => {
  const { ids, percentage } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler('Please provide an array of product IDs', 400));
  }

  if (percentage === undefined || isNaN(percentage)) {
    return next(new ErrorHandler('Please provide a valid percentage', 400));
  }

  const multiplier = 1 + (Number(percentage) / 100);

  // Mongoose updateMany with aggregation pipeline to allow calculation and rounding
  const result = await Product.updateMany(
    { _id: { $in: ids } },
    [{ $set: { price: { $round: [{ $multiply: ['$price', multiplier] }, 2] } } }]
  );

  if (result.modifiedCount > 0) {
    getIO().emit('products_updated');
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) prices updated successfully`,
    modifiedCount: result.modifiedCount,
  });
});

/**
 * @desc    Bulk update products status
 * @route   POST /api/v1/products/bulk-status-update
 * @access  Private/Admin
 */
export const bulkStatusUpdate = asyncHandler(async (req, res, next) => {
  const { ids, status } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler('Please provide an array of product IDs', 400));
  }

  const validStatuses = ['active', 'inactive', 'out_of_stock'];
  if (!status || !validStatuses.includes(status)) {
    return next(new ErrorHandler(`Status must be one of: ${validStatuses.join(', ')}`, 400));
  }

  const result = await Product.updateMany(
    { _id: { $in: ids } },
    { $set: { status: status } }
  );

  if (result.modifiedCount > 0) {
    getIO().emit('products_updated');
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) status updated successfully`,
    modifiedCount: result.modifiedCount,
  });
});

/**
 * @desc    Bulk update products stock
 * @route   POST /api/v1/products/bulk-stock-update
 * @access  Private/Admin
 */
export const bulkStockUpdate = asyncHandler(async (req, res, next) => {
  const { ids, stock } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return next(new ErrorHandler('Please provide an array of product IDs', 400));
  }

  const stockValue = Number(stock);
  if (isNaN(stockValue) || stockValue < 0) {
    return next(new ErrorHandler('Please provide a valid stock quantity (>= 0)', 400));
  }

  let updatePipeline;
  if (stockValue === 0) {
    updatePipeline = [{ $set: { stock: 0, status: 'out_of_stock' } }];
  } else {
    updatePipeline = [
      {
        $set: {
          stock: stockValue,
          status: {
            $cond: {
              if: { $eq: ['$status', 'out_of_stock'] },
              then: 'active',
              else: '$status'
            }
          }
        }
      }
    ];
  }

  const result = await Product.updateMany(
    { _id: { $in: ids } },
    updatePipeline
  );

  if (result.modifiedCount > 0) {
    getIO().emit('products_updated');
  }

  res.status(200).json({
    success: true,
    message: `${result.modifiedCount} product(s) stock updated successfully`,
    modifiedCount: result.modifiedCount,
  });
});


/**
 * @desc    Get product statistics (aggregate pipeline)
 * @route   GET /api/v1/products/stats
 * @access  Private/Admin
 */
export const getProductStats = asyncHandler(async (req, res) => {
  // Only consider active (not deleted) products
  const matchCondition = { isDeleted: false };

  const stats = await Product.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        totalStock: { $sum: '$stock' },
        outOfStock: {
          $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] }, // use status
        },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Overall totals
  const totals = await Product.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        avgPrice: { $avg: '$price' },
        totalStock: { $sum: '$stock' },
        totalInventoryValue: { $sum: { $multiply: ['$price', '$stock'] } },
        outOfStock: {
          $sum: { $cond: [{ $eq: ['$status', 'out_of_stock'] }, 1, 0] },
        },
        totalActive: {
           $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        totalInactive: {
           $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] },
        }
      },
    },
  ]);

  res.status(200).json({
    success: true,
    categoryStats: stats,
    totals: totals[0] || { 
      totalProducts: 0, 
      avgPrice: 0, 
      totalStock: 0, 
      outOfStock: 0, 
      totalActive: 0, 
      totalInactive: 0, 
      totalInventoryValue: 0 
    },
  });
});
