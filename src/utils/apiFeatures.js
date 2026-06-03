/**
 * ApiFeatures — chainable class for MongoDB query manipulation.
 * Supports search (name+sku), filter (status, category, date range, price range),
 * sort, pagination, and field limiting.
 */
class ApiFeatures {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }

  /**
   * Search by keyword — matches against product name OR sku (case-insensitive regex).
   */
  search() {
    if (this.queryStr.search) {
      const searchRegex = { $regex: this.queryStr.search, $options: 'i' };
      this.query = this.query.find({
        $or: [{ name: searchRegex }, { sku: searchRegex }, { code: searchRegex }],
      });
    }
    return this;
  }

  /**
   * Filter by query parameters.
   * Supports: status, category, price range (price[gte]/price[lte]),
   * date range (dateFrom/dateTo on createdAt).
   * Excludes soft-deleted products by default.
   * Use deleted=only to view deleted products, or deleted=include to include both.
   */
  filter() {
    const filterObj = {};

    if (this.queryStr.deleted === 'only') {
      filterObj.isDeleted = true;
    } else if (this.queryStr.deleted !== 'include') {
      filterObj.isDeleted = false;
    }

    // Status filter
    if (this.queryStr.status) {
      filterObj.status = this.queryStr.status;
    }

    // Category filter
    if (this.queryStr.category) {
      filterObj.category = this.queryStr.category;
    }

    // Price range
    if (this.queryStr['price[gte]'] || this.queryStr['price[lte]']) {
      filterObj.price = {};
      if (this.queryStr['price[gte]']) {
        filterObj.price.$gte = parseFloat(this.queryStr['price[gte]']);
      }
      if (this.queryStr['price[lte]']) {
        filterObj.price.$lte = parseFloat(this.queryStr['price[lte]']);
      }
    }

    // Date range on createdAt
    if (this.queryStr.dateFrom || this.queryStr.dateTo) {
      filterObj.createdAt = {};
      if (this.queryStr.dateFrom) {
        filterObj.createdAt.$gte = new Date(this.queryStr.dateFrom);
      }
      if (this.queryStr.dateTo) {
        // Set to end of the day
        const endDate = new Date(this.queryStr.dateTo);
        endDate.setHours(23, 59, 59, 999);
        filterObj.createdAt.$lte = endDate;
      }
    }

    // isPurchased filter (for gift cards)
    if (this.queryStr.isPurchased !== undefined) {
      filterObj.isPurchased = this.queryStr.isPurchased === 'true';
    }

    this.query = this.query.find(filterObj);
    return this;
  }

  /**
   * Sort results. Defaults to newest first (-createdAt).
   * Accepts comma-separated sort fields: ?sort=price,-createdAt
   */
  sort() {
    if (this.queryStr.sort) {
      const sortBy = this.queryStr.sort.split(',').join(' ');
      // Always append _id as a tie-breaker for stable pagination
      this.query = this.query.sort(`${sortBy} _id`);
    } else {
      this.query = this.query.sort('-createdAt _id');
    }
    return this;
  }

  /**
   * Paginate results. Defaults to page 1, 12 items per page.
   */
  paginate() {
    const page = parseInt(this.queryStr.page, 10) || 1;
    const limit = parseInt(this.queryStr.limit, 10) || 12;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);
    this.page = page;
    this.limit = limit;
    return this;
  }

  /**
   * Limit returned fields. Defaults to excluding __v.
   */
  limitFields() {
    if (this.queryStr.fields) {
      const fields = this.queryStr.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }
    return this;
  }
}

export default ApiFeatures;
