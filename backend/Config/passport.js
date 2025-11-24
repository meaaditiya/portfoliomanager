const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // User exists - link Google ID if not already linked
          if (!user.googleId) {
            user.googleId = profile.id;
            user.isVerified = true; // Google accounts are pre-verified
            await user.save();
          }
          return done(null, user);
        }

        // Create new user
        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8), // Random password
          isVerified: true // Google accounts are pre-verified
        });

        await user.save();
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);

module.exports = passport;