import React, { useState, useEffect } from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
import { io } from 'socket.io-client';
import ChatRoom from './components/ChatRoom';
import VideoCall from './components/VideoCall';
import ParticleBackground from './components/ParticleBackground';
import { SocketContext } from './contexts/SocketContext';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [socket, setSocket] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [currentTheme, setCurrentTheme] = useState([theme.defaultAlgorithm]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  useEffect(() => {
    // 初始化Socket连接
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    setCurrentTheme(isDarkMode ? [theme.defaultAlgorithm] : [theme.darkAlgorithm]);
  };

  const handleStreamUpdate = (stream) => {
    setLocalStream(stream);
  };

  if (!socket) {
    return (
      <div className="loading-container">
        <ParticleBackground />
        <div className="loading-content">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <h2>正在连接聊天室...</h2>
          <p>请稍候，正在建立安全连接</p>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider theme={{ algorithm: currentTheme }}>
      <SocketContext.Provider value={socket}>
        <ParticleBackground />
        <Layout className="app-layout">
          <Header className="app-header">
            <div className="header-content">
              <h1>在线聊天室</h1>
              <div className="header-controls">
                <button 
                  className="theme-toggle"
                  onClick={toggleTheme}
                >
                  {isDarkMode ? '🌞' : '🌙'}
                </button>
                <button 
                  className="video-toggle"
                  onClick={() => setIsVideoCall(!isVideoCall)}
                >
                  {isVideoCall ? '💬' : '📹'}
                </button>
              </div>
            </div>
          </Header>
          <Content className="app-content">
            {isVideoCall ? (
              <VideoCall 
                onBack={() => setIsVideoCall(false)} 
                onStreamUpdate={handleStreamUpdate}
              />
                    ) : (
                      <ChatRoom 
                        onStartVideo={() => setIsVideoCall(true)} 
                        localStream={localStream}
                        remoteStream={remoteStream}
                        onStreamUpdate={handleStreamUpdate}
                      />
                    )}
          </Content>
        </Layout>
      </SocketContext.Provider>
    </ConfigProvider>
  );
}

export default App;
