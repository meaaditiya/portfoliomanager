const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/userSchema');

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_CALLBACK_URL,
      scope: ['identify', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.email || `${profile.id}@discord.local`;

        let user = await User.findOne({ email });

        const avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
          : null;

        if (user) {
          if (!user.discordId) {
            user.discordId = profile.id;
            user.isVerified = true;
          }
          user.profilePicture = avatar;
          await user.save();
          return done(null, user);
        }

        user = new User({
          discordId: profile.id,
          name: profile.username,
          email,
          password:
            Math.random().toString(36).slice(-8) +
            Math.random().toString(36).slice(-8),
          isVerified: true,
          profilePicture: avatar
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
