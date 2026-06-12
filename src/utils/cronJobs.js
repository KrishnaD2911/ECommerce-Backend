import cron from 'node-cron';
import GiftCard from '../models/giftCard.model.js';

export const runGiftCardStatusUpdates = async () => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Activate inactive gift cards where activationDate is today or earlier
    await GiftCard.updateMany(
      {
        status: 'inactive',
        activationDate: { $ne: null, $lte: today },
      },
      {
        $set: { status: 'active' },
      }
    );

    // Expire active gift cards where expiryDate is before today
    await GiftCard.updateMany(
      {
        status: 'active',
        expiryDate: { $ne: null, $lt: today },
      },
      {
        $set: { status: 'expired' },
      }
    );
  } catch (error) {
    console.error('Error in gift card status update:', error);
  }
};

const startCronJobs = () => {
  // Run on startup
  runGiftCardStatusUpdates();

  // Run every day at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily gift card status check...');
    runGiftCardStatusUpdates();
  });
};

export default startCronJobs;
