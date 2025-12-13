const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();
const path = require('path');
const fs = require("fs");
const http = require('http');                
const { Server } = require('socket.io');    
const connectDB = require("./Config/db");
const session = require('express-session');
const passport = require('./Config/passport');
const { initializeSecurity, logger } = require('./security/securityService');

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

const app = express();
const server = http.createServer(app);

if (!fs.existsSync("./keys")) {
  fs.mkdirSync("./keys");
}
fs.writeFileSync("./keys/gcs.json", process.env.GCS_JSON);

const security = initializeSecurity(app);

app.use(cors(security.corsConfig));

const io = new Server(server, {
  cors: security.corsConfig,
  pingTimeout: 60000,
  pingInterval: 25000
});

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
      sameSite: 'lax'
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 5000;

connectDB();

app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    activeConnections: io.engine.clientsCount
  });
});

app.use(security.publicLimiter);

app.use('/api/admin', security.strictLimiter, adminRoutes);
app.use('/api/auth', security.authLimiter, userAuth);

app.use(embeddingRoutes);
app.use(BlogSubmission);
app.use(BlogRoutes);
app.use(queryRoutes);
app.use(superAdminRoutes);
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

const visitorSocket = require('./socket/visitorSocket');
visitorSocket(io);

app.use(security.errorLogger);

app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'CORS policy violation',
      message: 'Origin not allowed'
    });
  }

  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Socket.IO ready for connections`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = { app, server };