const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const path = require('path');
const fs = require("fs");
const http = require('http');                
const { Server } = require('socket.io');    
const connectDB = require("./Config/db");
const session = require('express-session');
const passport = require('passport');
require('./Config/passport');
require('./Config/passportGithub');
require('./Config/discord.js');
const { initializeSecurity, logger } = require('./security/securityService');
const corsMiddleware = require("./middlewares/corsMiddleware.js");

const adminRoutes = require("./Routes/AdminRoutes.js");
const queryRoutes = require("./Routes/QueryRoutes.js");
const superAdminRoutes = require("./Routes/superAdminRoutes.js");
const announcementRoutes = require("./Routes/Announcement.js");
const BlogSubmission = require("./Routes/BlogSubmission.js");
const BlogRoutes = require("./Routes/BlogRoutes.js");
const ContactRoutes = require("./Routes/Contact.js");
const ImageRoutes = require("./Routes/ImagePosts.js");
const SocialMediaEmbed = require("./Routes/SocialEmbedds.js");
const projectRoutes = require("./Routes/Project.js");
const EmailRoutes = require("./Routes/Email.js");
const ProfileRoutes = require("./Routes/Profile.js");
const QuoteRoutes = require("./Routes/Quote.js");
const CommunityPostRoutes = require("./Routes/Community.js");
const AudioMessageRoutes = require("./Routes/AudioMessage.js");
const StreamRoutes = require("./Routes/Streams.js");
const visitorRoutes = require("./Routes/Visitor.js");
const embeddingRoutes = require("./Routes/embeddingRoutes.js");
const DocumentRoutes = require("./Routes/documents.js");
const userAuth = require("./Routes/UserAuthenticationRoutes.js");
const FeaturedProjects = require("./Routes/FeaturedProjects.js");
const PrivacyPolicyRoutes = require("./Routes/PrivacyPolicy.js");

const app = express();
const server = http.createServer(app);

if (!fs.existsSync("./keys")) {
  fs.mkdirSync("./keys");
}
fs.writeFileSync("./keys/gcs.json", process.env.GCS_JSON);

console.log('Starting server initialization...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 5000);

async function initializeApp() {
  try {
    console.log('Initializing security...');
    const security = await initializeSecurity(app);
    console.log('Security initialized successfully');

    app.use(security.helmet);
    app.use(security.securityHeaders);
    app.use(security.compression);
    app.use(security.urlValidation);
    app.use(security.requestValidation);

    if (process.env.NODE_ENV !== 'test') {
      app.use(security.requestLogger);
    }

    app.use(security.suspiciousActivity);
    app.use(...security.sanitization);
    
    app.use(corsMiddleware);
    app.options('*', corsMiddleware);

    console.log('Setting up Socket.IO...');
    const io = new Server(server, {
      cors: {
        origin: function(origin, callback) {
          const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'https://connectwithaaditiya.onrender.com',
            'https://connectwithaaditiyamg.onrender.com',
            'https://connectwithaaditiyaadmin.onrender.com',
            'http://192.168.1.33:5174',
            'http://192.168.1.33:5173',
            'https://aaditiyatyagi.vercel.app'
          ];
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST']
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });
    console.log('Socket.IO configured');

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'your_session_secret_here',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000,
          sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
        }
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    const PORT = process.env.PORT || 5000;

    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    app.use('/public', express.static(path.join(__dirname, 'public')));

    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date(),
        activeConnections: io.engine.clientsCount,
        redis: security.isRedisConnected() ? 'connected' : 'disconnected'
      });
    });

    console.log('Setting up routes...');
    app.use(queryRoutes);
    app.use(security.burstLimiter);
    app.use(security.publicLimiter);

    app.use('/api', userAuth);
    app.use("/api/admin", adminRoutes);
    app.use(superAdminRoutes);
    app.use(embeddingRoutes);
    app.use(BlogSubmission);
    app.use(BlogRoutes);
    app.use(ContactRoutes);
    app.use(announcementRoutes);
    app.use(projectRoutes);
    app.use(EmailRoutes);
    app.use(AudioMessageRoutes);
    app.use(StreamRoutes);
    app.use(ProfileRoutes);
    app.use(QuoteRoutes);
    app.use(ImageRoutes);
    app.use(SocialMediaEmbed);
    app.use(CommunityPostRoutes);
    app.use('/api/visitors', visitorRoutes);
    app.use(DocumentRoutes);
    app.use(FeaturedProjects);
    app.use(PrivacyPolicyRoutes);
    console.log('Routes configured');

    console.log('Setting up visitor socket...');
    const visitorSocket = require('./socket/visitorSocket');
    visitorSocket(io);
    console.log('Visitor socket configured');

    app.use(security.errorLogger);

    app.use((err, req, res, next) => {
      if (err.message === 'Not allowed by CORS' || err.message === 'CORS: Origin not allowed.') {
        return res.status(403).json({ 
          error: 'CORS policy violation',
          message: 'Origin not allowed'
        });
      }

      if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload too large' });
      }

      console.error('Unhandled error:', err);
      logger.error('Unhandled error:', err);
      
      res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : err.message
      });
    });

    app.use((req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    console.log(`Starting server on port ${PORT}...`);
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✅ Socket.IO ready for connections`);
      console.log(`✅ Redis: ${security.isRedisConnected() ? 'Connected' : 'Using memory store'}`);
      
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Socket.IO ready for connections`);
      logger.info(`Redis: ${security.isRedisConnected() ? 'Connected' : 'Using memory store'}`);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      logger.info('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        logger.info('Server closed');
        process.exit(0);
      });
    });

    return { app, server, security, io };
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

initializeApp().catch((error) => {
  console.error('❌ Fatal error during initialization:', error);
  console.error('Error stack:', error.stack);
  process.exit(1);
});

module.exports = { app, server };