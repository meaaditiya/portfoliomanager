
const express = require('express');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const path = require('path');
const corsMiddleware = require("./middlewares/corsMiddleware.js");
const cacheMiddleware = require("./middlewares/cacheMiddleware.js");
const connectDB = require("./Config/db");

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


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(corsMiddleware);
const PORT = process.env.PORT || 5000;
connectDB();


app.use("/api/admin", adminRoutes);
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
app.use(cacheMiddleware);
app.use(ImageRoutes);
app.use(SocialMediaEmbed);
app.use(CommunityPostRoutes);

app.use('/public', express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
