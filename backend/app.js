
const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const path = require('path');
const http = require('http');                
const { Server } = require('socket.io');    
const corsMiddleware = require("./middlewares/corsMiddleware.js");
const connectDB = require("./Config/db");
const session = require('express-session');
const adminRoutes = require("./Routes/AdminRoutes.js");
const queryRoutes = require("./Routes/QueryRoutes.js");
const superAdminRoutes = require("./Routes/superAdminRoutes.js");
const announcementRoutes = require("./Routes/Announcement.js");
const BlogSubmission = require("./Routes/BlogSubmission.js");
const BlogRoutes = require("./Routes/BlogRoutes.js");
const ContactRoutes = require("./Routes/Contact.js");
const ImageRoutes   = require("./Routes/ImagePosts.js");
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
const userAuth = require("./Routes/UserAuthenticationRoutes.js");
const passport = require('./Config/passport');
const app = express();
const server = http.createServer(app); 
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(corsMiddleware);
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your_session_secret_here',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
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
app.use(CommunityPostRoutes)
app.use('/api/visitors', visitorRoutes);


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
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
});
