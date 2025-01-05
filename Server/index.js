import { connectDB } from './db/index.js';
import dotenv from 'dotenv';
import { app } from './app.js';
import http from 'http';
import initializeSocket from './server.js';

dotenv.config({ path: './.env' }); // Load environment variables

const server = http.createServer(app);

// Initialize Socket.IO and attach it to the server
const io = initializeSocket(server);
app.set('socketio', io); // Attach Socket.IO instance to the app

// Connect to the database
connectDB()
  .then(() => {
    app.on('error', (error) => {
      console.error('Server error:', error);
      throw error;
    });

    const PORT = process.env.PORT || 8000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });
