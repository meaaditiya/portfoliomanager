import React, { useEffect, useRef, useState, useCallback } from 'react';
import AgoraRTC from 'agora-rtc-sdk-ng';
import './Adminchat.css';

const Adminchat = ({ appId, channel, token }) => {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [audioState, setAudioState] = useState({ enabled: false, muted: false });
  const [remoteUsers, setRemoteUsers] = useState(new Map());
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ duration: 0, participants: 0 });

  const localAudioTrack = useRef(null);
  const clientRef = useRef(null);
  const mountedRef = useRef(true);
  const connectionTimeRef = useRef(null);
  const statsIntervalRef = useRef(null);
  const joiningRef = useRef(false);
  const hasJoinedOnce = useRef(false);

  const stopDurationTimer = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    connectionTimeRef.current = null;
  }, []);

  const updateStats = useCallback(() => {
    if (mountedRef.current) {
      setStats((prev) => ({
        ...prev,
        participants: remoteUsers.size + (connectionState === 'connected' ? 1 : 0),
      }));
    }
  }, [remoteUsers.size, connectionState]);

  const cleanup = useCallback(async () => {
    try {
      stopDurationTimer();

      if (localAudioTrack.current) {
        localAudioTrack.current.close();
        localAudioTrack.current = null;
      }

      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }

      if (mountedRef.current) {
        setConnectionState('disconnected');
        setAudioState({ enabled: false, muted: false });
        setRemoteUsers(new Map());
        setStats({ duration: 0, participants: 0 });
        setError(null);
      }
    } catch (err) {
      console.error('Cleanup error:', err);
      if (mountedRef.current) {
        setError(`Cleanup error: ${err.message}`);
      }
    }
  }, [stopDurationTimer]);

  const setupEventListeners = useCallback(() => {
    if (!clientRef.current) return;

    clientRef.current.on('user-joined', (user) => {
      console.log('User joined:', user.uid);
      if (mountedRef.current) {
        setRemoteUsers((prev) => new Map(prev.set(user.uid, { ...user, audioTrack: null })));
        updateStats();
      }
    });

    clientRef.current.on('user-left', (user) => {
      console.log('User left:', user.uid);
      if (mountedRef.current) {
        setRemoteUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(user.uid);
          return newMap;
        });
        updateStats();
      }
    });

    clientRef.current.on('user-published', async (user, mediaType) => {
      if (mediaType === 'audio') {
        try {
          await clientRef.current.subscribe(user, mediaType);
          console.log('Subscribed to user audio:', user.uid);

          if (mountedRef.current) {
            setRemoteUsers((prev) => {
              const newMap = new Map(prev);
              const existingUser = newMap.get(user.uid) || {};
              newMap.set(user.uid, { ...existingUser, audioTrack: user.audioTrack });
              return newMap;
            });

            if (user.audioTrack) {
              user.audioTrack.play();
            }
          }
        } catch (err) {
          console.error('Failed to subscribe to user:', err);
          if (mountedRef.current) {
            setError(`Failed to subscribe to user: ${err.message}`);
          }
        }
      }
    });

    clientRef.current.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') {
        console.log('User unpublished audio:', user.uid);
        if (mountedRef.current) {
          setRemoteUsers((prev) => {
            const newMap = new Map(prev);
            const existingUser = newMap.get(user.uid);
            if (existingUser) {
              newMap.set(user.uid, { ...existingUser, audioTrack: null });
            }
            return newMap;
          });
        }
      }
    });

    clientRef.current.on('connection-state-change', (state) => {
      console.log('Connection state changed:', state);
      if (mountedRef.current) {
        setConnectionState(state);
      }
    });

    clientRef.current.on('exception', (evt) => {
      console.error('Agora exception:', evt);
      if (mountedRef.current) {
        setError(`Agora exception: ${evt.msg} (code: ${evt.code})`);
      }
    });
  }, [updateStats]);

  useEffect(() => {
    mountedRef.current = true;

    if (!clientRef.current) {
      clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      setupEventListeners();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [setupEventListeners, cleanup]);

  const startDurationTimer = useCallback(() => {
    connectionTimeRef.current = Date.now();
    statsIntervalRef.current = setInterval(() => {
      if (mountedRef.current && connectionTimeRef.current) {
        const duration = Math.floor((Date.now() - connectionTimeRef.current) / 1000);
        setStats((prev) => ({ ...prev, duration }));
      }
    }, 1000);
  }, []);

  const joinRoom = useCallback(async () => {
    if (joiningRef.current || hasJoinedOnce.current) return;
    joiningRef.current = true;

    if (!appId || !channel || !token || !clientRef.current) {
      setError('Missing required parameters: appId, channel, or token');
      joiningRef.current = false;
      return;
    }

    try {
      setConnectionState('connecting');
      setError(null);

      console.log('Joining channel:', { appId, channel, token });

      await clientRef.current.join(appId, channel, token, null);

      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: 'music_standard',
      });

      await clientRef.current.publish(localAudioTrack.current);

      if (mountedRef.current) {
        setConnectionState('connected');
        setAudioState({ enabled: true, muted: false });
        startDurationTimer();
        updateStats();
        hasJoinedOnce.current = true;
      }

      console.log('Successfully joined channel as host');
    } catch (err) {
      console.error('Failed to join room:', err);
      if (mountedRef.current) {
        setConnectionState('error');
        setError(
          err.code === 'OPERATION_ABORTED'
            ? 'Join was aborted, possibly due to fast component update or cleanup'
            : `Failed to join room: ${err.message}`
        );
      }
    } finally {
      joiningRef.current = false;
    }
  }, [appId, channel, token, startDurationTimer, updateStats]);

  const leaveRoom = useCallback(async () => {
    try {
      setConnectionState('disconnected');
      stopDurationTimer();

      if (localAudioTrack.current && clientRef.current) {
        await clientRef.current.unpublish(localAudioTrack.current);
        localAudioTrack.current.close();
        localAudioTrack.current = null;
      }

      if (clientRef.current) {
        await clientRef.current.leave();
      }

      if (mountedRef.current) {
        setAudioState({ enabled: false, muted: false });
        setRemoteUsers(new Map());
        setError(null);
        setStats({ duration: 0, participants: 0 });
      }

      console.log('Successfully left channel');
    } catch (err) {
      console.error('Error leaving room:', err);
      if (mountedRef.current) {
        setError(`Error leaving room: ${err.message}`);
      }
    }
  }, [stopDurationTimer]);

  const toggleMute = useCallback(async () => {
    if (!localAudioTrack.current) return;

    try {
      const newMutedState = !audioState.muted;
      await localAudioTrack.current.setEnabled(!newMutedState);

      if (mountedRef.current) {
        setAudioState((prev) => ({ ...prev, muted: newMutedState }));
      }
    } catch (err) {
      console.error('Error toggling mute:', err);
      if (mountedRef.current) {
        setError('Failed to toggle mute');
      }
    }
  }, [audioState.muted]);

  const muteRemoteUser = useCallback(
    async (uid) => {
      const user = remoteUsers.get(uid);
      if (user && user.audioTrack) {
        try {
          const currentVolume = user.audioTrack.getVolumeLevel();
          const newVolume = currentVolume > 0 ? 0 : 100;
          user.audioTrack.setVolume(newVolume);

          setRemoteUsers((prev) => {
            const newMap = new Map(prev);
            const existingUser = newMap.get(uid);
            if (existingUser) {
              newMap.set(uid, { ...existingUser, muted: newVolume === 0 });
            }
            return newMap;
          });
        } catch (err) {
          console.error('Error muting remote user:', err);
          if (mountedRef.current) {
            setError(`Failed to mute user ${uid}: ${err.message}`);
          }
        }
      }
    },
    [remoteUsers]
  );

  const kickUser = useCallback(async (uid) => {
    console.log('Kick user functionality would be implemented on the server side');
    if (mountedRef.current) {
      setError('Kick functionality requires server-side implementation');
    }
  }, []);

  useEffect(() => {
    let cancel = false;

    if (appId && channel && token && connectionState === 'disconnected') {
      joinRoom();
    }

    return () => {
      cancel = true;
      if (!joiningRef.current && connectionState !== 'disconnected') {
        leaveRoom();
      }
    };
  }, [appId, channel, token, connectionState, joinRoom, leaveRoom]);

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0
      ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      : `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="admin-chat-container">
      <div className="admin-chat-header">
        <h2>🎙️ Admin Audio Chat</h2>
        <div className="connection-status">
          <span className={`status-indicator ${connectionState}`}></span>
          <span className="status-text">
            {connectionState === 'connected'
              ? 'Live'
              : connectionState === 'connecting'
              ? 'Connecting...'
              : connectionState === 'error'
              ? 'Error'
              : 'Disconnected'}
          </span>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="close-btn">
            ×
          </button>
        </div>
      )}

      <div className="room-info">
        <div className="room-details">
          <h3>Room: {channel}</h3>
          <div className="stats">
            <span>Duration: {formatDuration(stats.duration)}</span>
            <span>Participants: {stats.participants}</span>
          </div>
        </div>
      </div>

      <div className="controls-section">
        <div className="primary-controls">
          {connectionState === 'connected' ? (
            <>
              <button
                onClick={toggleMute}
                className={`control-btn ${audioState.muted ? 'muted' : 'active'}`}
              >
                {audioState.muted ? '🔇' : '🎤'} {audioState.muted ? 'Unmute' : 'Mute'}
              </button>
              <button onClick={leaveRoom} className="control-btn danger">
                📞 Leave Room
              </button>
            </>
          ) : (
            <button
              onClick={joinRoom}
              className="control-btn primary"
              disabled={connectionState === 'connecting'}
            >
              {connectionState === 'connecting' ? '🔄 Connecting...' : '🎤 Join as Host'}
            </button>
          )}
        </div>
      </div>

      {connectionState === 'connected' && (
        <div className="participants-section">
          <h3>Participants ({remoteUsers.size})</h3>
          <div className="participants-list">
            <div className="participant host">
              <div className="participant-info">
                <span className="participant-name">You (Host)</span>
                <span className="participant-status">
                  {audioState.muted ? '🔇 Muted' : '🎤 Speaking'}
                </span>
              </div>
            </div>

            {Array.from(remoteUsers.entries()).map(([uid, user]) => (
              <div key={uid} className="participant">
                <div className="participant-info">
                  <span className="participant-name">User {uid}</span>
                  <span className="participant-status">
                    {user.audioTrack ? (user.muted ? '🔇 Muted' : '🎤 Connected') : '🔇 No Audio'}
                  </span>
                </div>
                <div className="participant-controls">
                  <button
                    onClick={() => muteRemoteUser(uid)}
                    className="control-btn small"
                    disabled={!user.audioTrack}
                  >
                    {user.muted ? 'Unmute' : 'Mute'}
                  </button>
                  <button
                    onClick={() => kickUser(uid)}
                    className="control-btn small danger"
                  >
                    Kick
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="debug-info">
        <details>
          <summary>Debug Information</summary>
          <pre>
            {JSON.stringify(
              {
                connectionState,
                audioState,
                participants: remoteUsers.size,
                appId: appId ? 'Set' : 'Missing',
                channel,
                token: token ? 'Set' : 'Missing',
              },
              null,
              2
            )}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default Adminchat;
