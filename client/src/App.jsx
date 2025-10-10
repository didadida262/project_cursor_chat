import React, { useState, useEffect } from 'react';
import { Layout, ConfigProvider, App as AntdApp } from 'antd';
import HttpChatRoom from './components/HttpChatRoom';
import ParticleBackground from './components/ParticleBackground';
import './App.css';

const { Header, Content } = Layout;

function App() {

  return (
    <ConfigProvider>
      <AntdApp>
        <ParticleBackground />
        <Layout className="app-layout">
          <Header className="app-header">
            <div className="header-content">
              <h1>加密频道</h1>
            </div>
          </Header>
          <Content className="app-content">
            <HttpChatRoom />
          </Content>
        </Layout>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
