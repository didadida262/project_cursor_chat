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

// 生成用户ID的函数

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
  const previousUsersRef = useRef([]);
  const isFirstLoadRef = useRef(true);

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

  // 初始化聊天API - 使用 useRef 确保只创建一次
  const chatAPIInitialized = useRef(false);
  
  // 初始化聊天API
  useEffect(() => {
    if (chatAPIInitialized.current) return;
    chatAPIInitialized.current = true;
    
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3002';
    
    chatAPI.current = new SimpleChatAPI(baseUrl);
    
    // 设置回调 - 使用稳定的引用
    chatAPI.current.onMessage((newMessages) => {
      if (Array.isArray(newMessages)) {
        setMessages(newMessages);
      }
    });
    
    chatAPI.current.onUsers((userList) => {
      // 检查用户列表变化，显示提示信息
      const previousUsers = previousUsersRef.current;
      const currentUserIds = new Set(userList.map(u => u.id));
      const previousUserIds = new Set(previousUsers.map(u => u.id));
      
      // 只在非首次加载时显示提示
      if (!isFirstLoadRef.current) {
        // 检查新加入的用户
        const newUsers = userList.filter(user => !previousUserIds.has(user.id));
        newUsers.forEach(user => {
          message.success({
            content: `🎉 ${user.nickname} 加入了聊天室`,
            duration: 3,
            style: {
              marginTop: '20px',
            },
          });
        });
        
        // 检查离开的用户
        const leftUsers = previousUsers.filter(user => !currentUserIds.has(user.id));
        leftUsers.forEach(user => {
          message.info({
            content: `👋 ${user.nickname} 离开了聊天室`,
            duration: 3,
            style: {
              marginTop: '20px',
            },
          });
        });
      } else {
        // 首次加载完成，后续更新将显示提示
        isFirstLoadRef.current = false;
      }
      
      // 更新之前的用户列表引用
      previousUsersRef.current = userList;
      
      // 直接更新用户列表，确保实时性
      console.log(`📊 收到用户列表更新: ${userList.length} 人`, userList.map(u => u.nickname));
      setUsers(userList);
    });
  }, []);

  // 页面事件监听器 - 只在用户连接后添加
  useEffect(() => {
    // 只在用户连接后才添加事件监听器
    if (!isConnected || !userInfo) {
      console.log('📡 用户未连接，跳过添加事件监听器');
      return;
    }

    console.log('📡 用户已连接，添加页面事件监听器');

    // 页面卸载时自动离开
    const handleBeforeUnload = (event) => {
      if (userInfoRef.current && isConnectedRef.current) {
        // 使用 sendBeacon 确保请求能够发送，传递关闭标签的原因
        const data = JSON.stringify({ userId: userInfoRef.current.id, reason: 'tab_close' });
        const success = navigator.sendBeacon(`${baseUrl}/api/leave`, data);
        console.log('🚪 页面卸载，自动离开聊天室', success ? '成功' : '失败', '原因: tab_close');
        
        // 如果 sendBeacon 失败，尝试同步请求
        if (!success) {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${baseUrl}/api/leave`, false); // 同步请求
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
            console.log('🚪 同步请求离开聊天室完成，原因: tab_close');
          } catch (error) {
            console.error('🚪 同步请求失败:', error);
          }
        }
      }
    };

    // 页面隐藏时也离开（移动端切换应用时）
    const handleVisibilityChange = () => {
      console.log('👁️ 页面可见性变化:', document.hidden ? '隐藏' : '显示');
      // 只有在页面真正隐藏且用户已连接时才离开
      if (document.hidden && userInfoRef.current && isConnectedRef.current) {
        console.log('👁️ 页面隐藏，开始离开聊天室');
        chatAPI.current.disconnect('page_refresh'); // 传递页面刷新的原因
        console.log('👁️ 页面隐藏，离开聊天室完成');
      }
    };

    // 页面获得焦点时立即获取最新数据
    const handleFocus = () => {
      if (isConnectedRef.current) {
        console.log('👁️ 页面重新获得焦点，立即获取最新数据');
        chatAPI.current.fetchLatestData();
      } else if (userInfoRef.current) {
        console.log('👁️ 页面重新获得焦点，尝试重新连接');
        // 延迟重新连接，避免频繁请求
        setTimeout(() => {
          if (!isConnectedRef.current && userInfoRef.current) {
            console.log('🔄 尝试重新连接到聊天室');
            chatAPI.current.connect(userInfoRef.current);
          }
        }, 1000);
      }
    };

    // 添加事件监听器
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isConnected, userInfo]); // 依赖用户连接状态，只在用户连接后添加事件监听器

  // 页面卸载时断开连接的单独 useEffect
  useEffect(() => {
    return () => {
      // 只在组件真正卸载时断开连接
      if (chatAPI.current) {
        chatAPI.current.disconnect('back_to_input'); // 传递返回输入页面的原因
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
      const trimmedNickname = nickname.trim();
      
      console.log('🚀 用户尝试加入聊天室:', trimmedNickname);
      
      // 先检查昵称是否已存在
      console.log('🔍 开始检查昵称是否已存在...');
      const nicknameCheck = await chatAPI.current.checkNickname(trimmedNickname);
      
      if (nicknameCheck.exists) {
        // 昵称已存在，显示警告
        message.warning(nicknameCheck.message);
        console.log('⚠️ 昵称已存在:', nicknameCheck.message);
        return;
      }
      
      if (nicknameCheck.error) {
        // 检查过程中发生错误
        message.error(nicknameCheck.error);
        console.error('❌ 昵称检查失败:', nicknameCheck.error);
        return;
      }
      
      // 昵称可用，继续加入聊天室
      const user = {
        id: generateUserId(),
        nickname: trimmedNickname,
        timestamp: new Date().toISOString()
      };

      console.log('✅ 昵称检查通过，开始连接聊天室:', user);
      
      // 先尝试连接，成功后再更新本地状态
      const success = await chatAPI.current.connect(user);
      
      if (success) {
        // 连接成功后才更新本地状态
        setUserInfo(user);
        setIsConnected(true);
        setShowNicknameInput(false);
        
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
        // 连接失败，不更新本地状态
        message.error('加入聊天室失败，请重试');
        console.error('❌ 加入聊天室失败');
      }
    }
  };

  // 发送消息
  const sendMessage = async () => {
    console.log('🔍 sendMessage 被调用');
    console.log('🔍 当前状态检查:', {
      currentMessage: currentMessage.trim(),
      userInfo: userInfo,
      isConnected: isConnected,
      userInfoId: userInfo?.id,
      userInfoNickname: userInfo?.nickname
    });
    
    if (currentMessage.trim() && userInfo && isConnected) {
      const messageText = currentMessage.trim();
      console.log('✅ 条件检查通过，开始发送消息:', messageText);
      
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
    } else {
      console.error('❌ 消息发送条件不满足:', {
        hasMessage: !!currentMessage.trim(),
        hasUserInfo: !!userInfo,
        isConnected: isConnected
      });
      message.error('消息发送失败，请重试');
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
              在线用户 ({users.filter(user => user.id !== userInfo?.id).length + 1})
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
