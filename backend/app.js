require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require("fs");
const http = require('http');                
const { Server } = require('socket.io');    
const corsMiddleware = require("./middlewares/corsMiddleware.js");
const connectDB = require("./Config/db");
const session = require('express-session');
const passport = require('./Config/passport');

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

app.set('trust proxy', true);

const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.FRONTEND_URL] 
      : ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

if (!fs.existsSync("./keys")) {
  fs.mkdirSync("./keys");
}
fs.writeFileSync("./keys/gcs.json", process.env.GCS_JSON);

const securityService = require("./security/securityService");

app.use(express.json({ 
  limit: '10mb',
  strict: true 
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb'
}));

app.use(cookieParser());
app.use(corsMiddleware);

const securityMiddlewares = securityService(app);
securityMiddlewares.forEach(middleware => app.use(middleware));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_session_secret_here',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 5000;
connectDB();

app.use(embeddingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", userAuth);
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
app.use('/public', express.static(path.join(__dirname, 'public')));

const visitorSocket = require('./socket/visitorSocket');
visitorSocket(io);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    activeConnections: io.engine.clientsCount
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request entity exceeds the maximum allowed size'
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist'
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Trust Proxy: ${app.get('trust proxy')}`);
  console.log(`Socket.IO ready for connections`);
  console.log(`Security layers: ACTIVE`);
});