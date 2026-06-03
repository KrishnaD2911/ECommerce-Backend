import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

mongoose.connect('mongodb://localhost:27017/ecommerce').then(async () => {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash('admin123', salt);
  await mongoose.connection.db.collection('users').updateOne(
    { email: 'admin@shopvault.com' },
    { $set: { password: hash } }
  );
  console.log('Password reset to admin123');
  process.exit(0);
}).catch(console.error);
