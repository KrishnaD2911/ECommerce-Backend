import dotenv from 'dotenv';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import { initSocket } from './src/socket.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`\nServer running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}/api/v1\n`);
    });

    initSocket(server);

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the existing server or choose another PORT.`);
      } else {
        console.error(`Server error: ${err.message}`);
      }
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error(`Unhandled Rejection: ${err.message}`);
      server.close(() => process.exit(1));
    });

  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
