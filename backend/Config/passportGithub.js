const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/userSchema');

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value ||
          `${profile.username}@github.local`;

        let user = await User.findOne({ email });

        if (user) {
          if (!user.githubId) {
            user.githubId = profile.id;
            user.isVerified = true;
          }
          user.profilePicture = profile.photos?.[0]?.value || null;
          await user.save();
          return done(null, user);
        }

        user = new User({
          githubId: profile.id,
          name: profile.displayName || profile.username,
          email,
          password:
            Math.random().toString(36).slice(-8) +
            Math.random().toString(36).slice(-8),
          isVerified: true,
          profilePicture: profile.photos?.[0]?.value || null
        });

        await user.save();
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

module.exports = passport;
