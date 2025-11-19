const Visitor = require('../models/Visitor');

// Helper to broadcast live count
const broadcastLiveCount = async (io) => {
  try {
    const liveCount = await Visitor.getLiveCount();
    io.emit('liveCountUpdate', { liveViewers: liveCount });
    return liveCount;
  } catch (error) {
    console.error('Error broadcasting live count:', error);
  }
};

// Helper to get IP from socket
const getSocketIp = (socket) => {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0] ||
         socket.handshake.headers['x-real-ip'] ||
         socket.handshake.address ||
         'unknown';
};

module.exports = (io) => {
  io.on('connection', async (socket) => {
    console.log(`🔌 New socket connection: ${socket.id}`);
    
    let sessionId = null;

    // Send current live count on connection
    await broadcastLiveCount(io);

    // Handle visitor join
    socket.on('visitorJoin', async (data) => {
      try {
        sessionId = data.sessionId;
        const page = data.page || '/';
        const ipAddress = getSocketIp(socket);
        const userAgent = socket.handshake.headers['user-agent'] || '';

        let visitor = await Visitor.findOne({ sessionId });

        if (visitor) {
          visitor.lastActivity = Date.now();
          visitor.isActive = true;
          visitor.page = page;
          visitor.socketId = socket.id;
          await visitor.save();
        } else {
          visitor = new Visitor({
            sessionId,
            socketId: socket.id,
            ipAddress,
            userAgent,
            page,
            isActive: true
          });
          await visitor.save();
        }

        await broadcastLiveCount(io);
        console.log(`✅ Visitor joined: ${sessionId}`);
      } catch (error) {
        console.error('❌ Error handling visitor join:', error);
      }
    });

    // Handle page changes
    socket.on('pageChange', async (data) => {
      try {
        if (!sessionId) return;
        await Visitor.updateActivity(sessionId, data.page, socket.id);
        console.log(`📄 Page change: ${sessionId} → ${data.page}`);
      } catch (error) {
        console.error('Error handling page change:', error);
      }
    });

    // Handle activity updates (heartbeat)
    socket.on('activityUpdate', async (data) => {
      try {
        if (!sessionId) return;
        await Visitor.updateActivity(sessionId, data.page, socket.id);
      } catch (error) {
        console.error('Error handling activity update:', error);
      }
    });

    // Handle manual leave
    socket.on('visitorLeave', async () => {
      try {
        if (sessionId) {
          await Visitor.markInactive(sessionId);
          await broadcastLiveCount(io);
          console.log(`👋 Visitor left: ${sessionId}`);
        }
      } catch (error) {
        console.error('Error handling visitor leave:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        if (sessionId) {
          await Visitor.markInactive(sessionId);
        } else {
          await Visitor.markInactiveBySocket(socket.id);
        }
        
        await broadcastLiveCount(io);
        console.log(`🔴 Socket disconnected: ${socket.id}`);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });
  });

  // Cleanup stale sessions every minute
  setInterval(async () => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      await Visitor.updateMany(
        { 
          lastActivity: { $lt: fiveMinutesAgo },
          isActive: true 
        },
        { 
          isActive: false,
          socketId: null
        }
      );

      await broadcastLiveCount(io);
    } catch (error) {
      console.error('Error in cleanup interval:', error);
    }
  }, 60000);
};