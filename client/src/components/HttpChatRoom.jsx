import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, Typography, Card, Space, Empty, App } from 'antd';
import { SendOutlined, UserOutlined } from '@ant-design/icons';
import SimpleUserCard from './SimpleUserCard';
import DraggableCurrentUserCard from './DraggableCurrentUserCard';
import SimpleChatAPI from '../utils/SimpleChatAPI';
import './SimpleChatRoom.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

function HttpChatRoom() {
  const { message } = App.useApp();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [nickname, setNickname] = useState('');
  const [showNicknameInput, setShowNicknameInput] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const chatAPI = useRef(null);
  const userInfoRef = useRef(null);
  const isConnectedRef = useRef(false);

  // 保持 ref 与 state 同步
  useEffect(() => {
    userInfoRef.current = userInfo;
  }, [userInfo]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // 滚动到底部
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化聊天API - 只在组件挂载时执行一次
  useEffect(() => {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3002';
    
    chatAPI.current = new SimpleChatAPI(baseUrl);
    
    // 设置回调
    chatAPI.current.onMessage((newMessages) => {
      if (Array.isArray(newMessages)) {
        setMessages(newMessages);
      }
    });
    
    chatAPI.current.onUsers((userList) => {
      setUsers(userList);
    });

    // 页面卸载时自动离开
    const handleBeforeUnload = () => {
      if (userInfoRef.current && isConnectedRef.current) {
        // 使用 sendBeacon 确保请求能够发送
        const data = JSON.stringify({ userId: userInfoRef.current.id });
        navigator.sendBeacon(`${baseUrl}/api/leave`, data);
        console.log('🚪 页面卸载，自动离开聊天室');
      }
    };

    // 页面隐藏时也离开（移动端切换应用时）
    const handleVisibilityChange = () => {
      if (document.hidden && userInfoRef.current && isConnectedRef.current) {
        chatAPI.current.disconnect();
        console.log('👁️ 页面隐藏，离开聊天室');
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  // 页面卸载时断开连接的单独 useEffect
  useEffect(() => {
    return () => {
      // 只在组件真正卸载时断开连接
      if (chatAPI.current) {
        chatAPI.current.disconnect();
      }
    };
  }, []); // 空依赖数组，只在组件卸载时执行

  // 生成唯一用户ID
  const generateUserId = () => {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.floor(Math.random() * 10000)}`;
  };

  // 加入聊天室
  const handleJoinChat = async () => {
    if (nickname.trim()) {
      const user = {
        id: generateUserId(),
        nickname: nickname.trim(),
        timestamp: new Date().toISOString()
      };

      console.log('🚀 用户尝试加入聊天室:', user);
      
      // 立即更新本地状态，实现乐观更新
      setUserInfo(user);
      setIsConnected(true);
      setShowNicknameInput(false);
      
      const success = await chatAPI.current.connect(user);
      
      if (success) {
        message.success(`欢迎 ${user.nickname}！`);
        console.log('✅ 成功加入聊天室');
        
        // 立即获取一次用户列表，减少延迟
        try {
          const baseUrl = process.env.NODE_ENV === 'production' 
            ? window.location.origin 
            : 'http://localhost:3002';
          const usersResponse = await fetch(`${baseUrl}/api/users`);
          if (usersResponse.ok) {
            const users = await usersResponse.json();
            setUsers(users);
          }
        } catch (error) {
          console.error('获取用户列表失败:', error);
        }
      } else {
        // 如果连接失败，回滚状态
        setUserInfo(null);
        setIsConnected(false);
        setShowNicknameInput(true);
        message.error('加入聊天室失败，请重试');
        console.error('❌ 加入聊天室失败');
      }
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (currentMessage.trim() && userInfo && isConnected) {
      const messageText = currentMessage.trim();
      
      // 立即清空输入框，提供即时反馈
      setCurrentMessage('');
      
      const success = await chatAPI.current.sendMessage(messageText);
      
      if (success) {
        console.log('✅ 消息发送成功');
      } else {
        // 发送失败时恢复输入框内容
        setCurrentMessage(messageText);
        message.error('消息发送失败，请重试');
        console.error('❌ 消息发送失败');
      }
    }
  };

  // 处理回车发送
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
    const isPending = msg.isPending;
    
    return (
      <div 
        key={msg.id} 
        className={`message-item ${isOwnMessage ? 'own-message' : 'other-message'} ${isPending ? 'pending-message' : ''}`}
      >
        <div className="message-content">
          <div className="message-header">
            <span className="message-nickname">{msg.nickname}</span>
            <span className="message-time">{formatTime(msg.timestamp)}</span>
            {isPending && <span className="message-status">发送中...</span>}
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
              style={{ marginBottom: 16 }}
              prefix={<UserOutlined />}
            />
            <Button type="primary" block onClick={handleJoinChat}>
              加入聊天室
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
              disabled={!currentMessage.trim() || !isConnected}
            >
              发送
            </Button>
          </div>
        </Content>
      </Layout>
    </>
  );
}

export default HttpChatRoom;
