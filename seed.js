import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './src/models/user.model.js';

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: 'admin@shopvault.com' });
    if (existing) {
      console.log('Admin user already exists. Skipping seed.');
    } else {
      await User.create({
        name: 'Admin',
        email: 'admin@shopvault.com',
        password: 'admin123',
        role: 'admin',
      });
      console.log('Admin user created successfully!');
      console.log('  Email: admin@shopvault.com');
      console.log('  Password: admin123');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seedAdmin();
