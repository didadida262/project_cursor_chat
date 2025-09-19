import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, List, Avatar, Typography, Card, Space, Empty, App } from 'antd';
import { SendOutlined, UserOutlined } from '@ant-design/icons';
import { SocketContext } from '../contexts/SocketContext';
import SimpleUserCard from './SimpleUserCard';
import DraggableCurrentUserCard from './DraggableCurrentUserCard';
import './SimpleChatRoom.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

function SimpleChatRoom() {
  const socket = React.useContext(SocketContext);
  const { message } = App.useApp();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [nickname, setNickname] = useState('');
  const messagesEndRef = useRef(null);
  const [showNicknameInput, setShowNicknameInput] = useState(true);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket事件监听
  useEffect(() => {
    if (!socket) return;

    // 监听新消息
    socket.on('message', (data) => {
      console.log('收到新消息:', data);
      setMessages(prev => [...prev, data]);
    });

    // 监听历史消息
    socket.on('messages', (messageList) => {
      console.log('收到历史消息:', messageList);
      setMessages(messageList);
    });

    // 监听用户列表更新
    socket.on('users', (userList) => {
      console.log('用户列表更新:', userList);
      setUsers(userList);
    });

    // 监听用户加入
    socket.on('userJoined', (user) => {
      console.log('用户加入:', user);
      message.success(`${user.nickname} 加入了聊天室`);
    });

    // 监听用户离开
    socket.on('userLeft', (user) => {
      console.log('用户离开:', user);
      message.info(`${user.nickname} 离开了聊天室`);
    });

    return () => {
      socket.off('message');
      socket.off('messages');
      socket.off('users');
      socket.off('userJoined');
      socket.off('userLeft');
    };
  }, [socket, message]);

  // 发送消息
  const sendMessage = () => {
    if (currentMessage.trim() && userInfo) {
      const messageData = {
        userId: userInfo.id,
        nickname: userInfo.nickname,
        message: currentMessage.trim()
      };

      socket.emit('message', messageData);
      setCurrentMessage('');
      console.log('发送消息:', messageData);
    }
  };

  // 处理回车发送
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 加入聊天室
  const handleJoinChat = () => {
    if (nickname.trim()) {
      const user = {
        id: socket.id,
        nickname: nickname.trim(),
        timestamp: new Date().toISOString()
      };

      console.log('🚀 用户尝试加入聊天室:', user);
      console.log('🔌 Socket连接状态:', socket.connected);
      
      setUserInfo(user);
      socket.emit('join', user);
      setShowNicknameInput(false);
      message.success(`欢迎 ${user.nickname}！`);
      
      console.log('📤 已发送join事件');
    }
  };

  // 格式化时间
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // 渲染消息项
  const renderMessage = (msg) => {
    const isOwnMessage = msg.userId === userInfo?.id;
    
    return (
      <div 
        key={msg.id} 
        className={`message-item ${isOwnMessage ? 'own-message' : 'other-message'}`}
      >
        <div className="message-content">
          <div className="message-header">
            <span className="message-nickname">{msg.nickname}</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
          </div>
          <div className="message-text">{msg.message}</div>
        </div>
      </div>
    );
  };

  // 如果还没设置昵称，显示昵称输入框
  if (showNicknameInput) {
    return (
      <div className="nickname-input-container">
        <Card className="nickname-card">
          <div className="nickname-input-content">
            <Title level={3} style={{ color: '#ffffff', marginBottom: 24 }}>
              欢迎来到聊天室
            </Title>
            <Input
              placeholder="请输入您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onPressEnter={handleJoinChat}
              style={{
                marginBottom: 16,
                height: 40
              }}
            />
            <Button 
              type="primary" 
              onClick={handleJoinChat}
              disabled={!nickname.trim()}
              style={{
                width: '100%',
                height: 40
              }}
            >
              进入聊天室
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* 可拖拽的当前用户卡片 */}
      {userInfo && (
        <DraggableCurrentUserCard user={userInfo} />
      )}
      
      <Layout className="simple-chat-room">
      {/* 左侧用户列表区域 - 占据70%宽度 */}
      <Sider width="70%" className="users-sidebar">
        <div className="users-header">
          <Title level={4} style={{ color: '#ffffff', margin: 0 }}>
            在线用户 ({users.length})
          </Title>
        </div>
        
        <div className="users-grid">
          {/* 其他用户卡片 */}
          {users
            .filter(user => user.id !== userInfo?.id)
            .map(user => (
              <div key={user.id} className="other-user-wrapper">
                <SimpleUserCard user={user} isCurrentUser={false} />
              </div>
            ))
          }
        </div>
      </Sider>

      {/* 右侧聊天区域 - 占据30%宽度 */}
      <Content className="chat-content">
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="empty-chat">
              <Empty 
                description="暂无消息" 
                style={{ 
                  color: '#ffffff',
                  marginTop: '100px'
                }}
              />
            </div>
          ) : (
            <div className="messages-list">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        <div className="input-container">
          <TextArea
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            style={{
              resize: 'none',
              height: '100px'
            }}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />} 
            onClick={sendMessage}
            disabled={!currentMessage.trim()}
          >
            发送
          </Button>
        </div>
      </Content>
    </Layout>
    </>
  );
}

export default SimpleChatRoom;
