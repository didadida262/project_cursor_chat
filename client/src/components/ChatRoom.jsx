import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, List, Avatar, Typography, Card, Space, message } from 'antd';
import { SendOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { SocketContext } from '../contexts/SocketContext';
import './ChatRoom.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

function ChatRoom({ onStartVideo }) {
  const socket = React.useContext(SocketContext);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [nickname, setNickname] = useState('');
  const messagesEndRef = useRef(null);
  const [showNicknameInput, setShowNicknameInput] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket) return;

    // 监听消息
    socket.on('message', (data) => {
      setMessages(prev => [...prev, data]);
    });

    // 监听用户列表更新
    socket.on('users', (userList) => {
      setUsers(userList);
    });

    // 监听用户加入
    socket.on('userJoined', (data) => {
      message.success(`${data.nickname} 加入了聊天室`);
    });

    // 监听用户离开
    socket.on('userLeft', (data) => {
      message.info(`${data.nickname} 离开了聊天室`);
    });

    // 监听连接成功
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    return () => {
      socket.off('message');
      socket.off('users');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('connect');
    };
  }, [socket]);

  const handleJoinChat = () => {
    if (!nickname.trim()) {
      message.error('请输入昵称');
      return;
    }
    
    const user = {
      id: socket.id,
      nickname: nickname.trim(),
      isOnline: true
    };
    
    setUserInfo(user);
    setShowNicknameInput(false);
    socket.emit('join', user);
  };

  const handleSendMessage = () => {
    if (!currentMessage.trim() || !userInfo) return;

    const messageData = {
      id: Date.now(),
      userId: userInfo.id,
      nickname: userInfo.nickname,
      message: currentMessage.trim(),
      timestamp: new Date().toISOString()
    };

    socket.emit('message', messageData);
    setCurrentMessage('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (showNicknameInput) {
    return (
      <div className="nickname-container">
        <Card className="nickname-card">
          <Title level={3}>欢迎加入聊天室</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              placeholder="请输入您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onPressEnter={handleJoinChat}
              size="large"
            />
            <Button 
              type="primary" 
              onClick={handleJoinChat}
              size="large"
              block
            >
              加入聊天
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  return (
    <Layout className="chat-room">
      <Sider width={250} className="user-sidebar">
        <div className="sidebar-header">
          <Title level={4}>在线用户 ({users.length})</Title>
        </div>
        <List
          dataSource={users}
          renderItem={(user) => (
            <List.Item className="user-item">
              <List.Item.Meta
                avatar={<Avatar icon={<UserOutlined />} />}
                title={user.nickname}
                description={user.isOnline ? '在线' : '离线'}
              />
            </List.Item>
          )}
        />
      </Sider>
      
      <Layout>
        <Content className="chat-content">
          <div className="messages-container">
            <List
              dataSource={messages}
              renderItem={(msg) => (
                <List.Item className="message-item">
                  <div className={`message ${msg.userId === userInfo?.id ? 'own-message' : ''}`}>
                    <div className="message-header">
                      <Avatar size="small" icon={<UserOutlined />} />
                      <Text strong>{msg.nickname}</Text>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </Text>
                    </div>
                    <div className="message-content">
                      <Text>{msg.message}</Text>
                    </div>
                  </div>
                </List.Item>
              )}
            />
            <div ref={messagesEndRef} />
          </div>
          
          <div className="input-container">
            <Space.Compact style={{ width: '100%' }}>
              <TextArea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入消息..."
                autoSize={{ minRows: 1, maxRows: 4 }}
                style={{ flex: 1 }}
              />
              <Button 
                type="primary" 
                icon={<SendOutlined />}
                onClick={handleSendMessage}
                disabled={!currentMessage.trim()}
              >
                发送
              </Button>
              <Button 
                icon={<VideoCameraOutlined />}
                onClick={onStartVideo}
                title="开始视频通话"
              >
                视频
              </Button>
            </Space.Compact>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default ChatRoom;
