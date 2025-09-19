import React, { useState, useEffect } from 'react';
import { Layout, ConfigProvider, App as AntdApp } from 'antd';
import { io } from 'socket.io-client';
import SimpleChatRoom from './components/SimpleChatRoom';
import ParticleBackground from './components/ParticleBackground';
import { SocketContext } from './contexts/SocketContext';
import './App.css';

const { Header, Content } = Layout;

function App() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // 初始化Socket连接
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

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
    <ConfigProvider>
      <AntdApp>
        <SocketContext.Provider value={socket}>
          <ParticleBackground />
          <Layout className="app-layout">
          <Header className="app-header">
            <div className="header-content">
              <h1>在线聊天室</h1>
            </div>
          </Header>
          <Content className="app-content">
            <SimpleChatRoom />
          </Content>
        </Layout>
        </SocketContext.Provider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
