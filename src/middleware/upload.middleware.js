import multer from 'multer';
import fs from 'fs';
import { ErrorHandler } from './error.middleware.js';

const uploadsDir = 'uploads/';

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, uniqueName);
  },
});

// Allow only image files
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ErrorHandler('Only image files (jpeg, png, gif, webp) are allowed', 400), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Single image upload
export const uploadSingle = upload.single('image');

// Multiple images upload (max 5)
export const uploadMultiple = upload.array('images', 5);
