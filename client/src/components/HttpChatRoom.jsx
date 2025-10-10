import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, Typography, Card, Space, Empty, App, notification, Modal, Spin } from 'antd';
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
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [nickname, setNickname] = useState('');
  const [showNicknameInput, setShowNicknameInput] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatAPI = useRef(null);
  const userInfoRef = useRef(null);
  const isConnectedRef = useRef(false);
  const previousUsersRef = useRef([]);
  const isFirstLoadRef = useRef(true);
  const modalVisibleRef = useRef(false);

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
    console.log('isMessagesLoading>>>>>>>>>>>>>>>>', isMessagesLoading);
  }, [isMessagesLoading]);

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
        // 与本地 pending 消息做合并，避免乐观消息闪烁
        setMessages((prev) => {
            setIsMessagesLoading(false);
          const pending = prev.filter(m => m.isPending);
          if (pending.length === 0) return newMessages;

          const merged = [...newMessages];

          pending.forEach(p => {
            // 匹配同一条消息（无服务器 id 的情况下，使用文本 + 用户 + 时间窗近似匹配）
            const hasMatch = newMessages.some(s => {
              if (!s) return false;
              // 首选使用 userId + message 精确匹配
              if (s.userId && p.userId) {
                return s.userId === p.userId && String(s.message) === String(p.message);
              }
              // 回退：使用昵称 + 文本 + 更宽时间窗匹配
              const serverTs = typeof s.timestamp === 'string' ? Date.parse(s.timestamp) : Number(s.timestamp);
              const localTs = typeof p.timestamp === 'string' ? Date.parse(p.timestamp) : Number(p.timestamp);
              const withinWindow = isFinite(serverTs) && isFinite(localTs) ? Math.abs(serverTs - localTs) <= 60000 : true;
              return String(s.message) === String(p.message) && s.nickname === p.nickname && withinWindow;
            });

            if (!hasMatch) {
              merged.push(p); // 仍未从服务器返回，保留本地 pending
            }
          });


          return merged;
        });
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
          notification.success({
            message: '🚀 新用户加入',
            description: `✨ ${user.nickname} 闪亮登场！`,
            placement: 'topRight',
            duration: 4,
          });
        });
        
        // 检查离开的用户
        const leftUsers = previousUsers.filter(user => !currentUserIds.has(user.id));
        leftUsers.forEach(user => {
          notification.info({
            message: '👋 用户离线',
            description: `💫 ${user.nickname} 已离开聊天室`,
            placement: 'topRight',
            duration: 4,
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

    // 页面卸载时的处理（直接删除用户数据，不显示确认弹窗）
    const handleBeforeUnload = (event) => {
      if (userInfoRef.current && isConnectedRef.current && !isLeaving) {
        console.log('🚪 页面即将卸载，直接删除用户数据');
        handleUserLeave('tab_close');
      }
    };

    // 页面隐藏时的处理
    const handleVisibilityChange = () => {
      console.log('👁️ 页面可见性变化:', document.hidden ? '隐藏' : '显示');
      
      if (document.hidden && userInfoRef.current && isConnectedRef.current) {
        console.log('👁️ 页面隐藏，用户切换到其他标签页，但仍在聊天室中');
        
        // 设置一个定时器，如果页面长时间隐藏，可能是用户关闭了标签页
        // 给一个较短的时间窗口来检测是否真的是标签页关闭
        const hiddenStartTime = Date.now();
        
        const checkIfStillHidden = () => {
          if (document.hidden) {
            const hiddenDuration = Date.now() - hiddenStartTime;
            
            // 如果页面隐藏超过3秒，可能是用户关闭了标签页
            // 此时主动删除用户数据
            if (hiddenDuration > 3000) {
              console.log('🚪 页面长时间隐藏，可能是标签页被关闭，主动删除用户数据');
              handleUserLeave('tab_close');
            }
          }
        };
        
        // 3秒后检查页面是否仍然隐藏
        setTimeout(checkIfStillHidden, 3000);
        
      } else if (!document.hidden && userInfoRef.current && isConnectedRef.current) {
        console.log('👁️ 页面重新显示，用户回到聊天室');
        // 页面重新获得焦点时立即获取最新数据
        chatAPI.current.fetchLatestData();
      }
    };
    
    // 统一的用户离开处理函数
    const handleUserLeave = (reason) => {
      if (userInfoRef.current && isConnectedRef.current) {
        console.log(`🚪 处理用户离开，原因: ${reason}`);
        
        try {
          if (chatAPI.current && chatAPI.current.userId) {
            const baseUrl = process.env.NODE_ENV === 'production' 
              ? window.location.origin 
              : 'http://localhost:3002';
            
            // 使用 sendBeacon 发送删除请求
            const success = navigator.sendBeacon(
              `${baseUrl}/api/leave`,
              JSON.stringify({
                userId: chatAPI.current.userId,
                reason: reason
              })
            );
            
            if (success) {
              console.log(`✅ 用户数据删除请求已发送 (${reason})`);
            } else {
              console.warn(`⚠️ 用户数据删除请求发送失败，尝试同步请求 (${reason})`);
              
              // 如果 sendBeacon 失败，尝试同步请求
              const xhr = new XMLHttpRequest();
              xhr.open('POST', `${baseUrl}/api/leave`, false); // 同步请求
              xhr.setRequestHeader('Content-Type', 'application/json');
              xhr.send(JSON.stringify({
                userId: chatAPI.current.userId,
                reason: reason
              }));
            }
          }
        } catch (error) {
          console.error('❌ 删除用户数据失败:', error);
        }
      }
    };

    // 页面获得焦点时的处理
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
        console.log('🧹 组件卸载，准备离开聊天室，原因: back_to_input');
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
      
      // 设置loading状态
      setIsJoining(true);
      
      console.log('🚀 用户尝试加入聊天室:', trimmedNickname);
      
      try {
        // 先检查昵称是否已存在
        console.log('🔍 开始检查昵称是否已存在...');
        const nicknameCheck = await chatAPI.current.checkNickname(trimmedNickname);
        
        if (nicknameCheck.exists) {
          // 昵称已存在，显示警告
          notification.warning({
            message: '⚠️ 昵称冲突',
            description: `💥 ${nicknameCheck.message}`,
            placement: 'topRight',
            duration: 5,
          });
          console.log('⚠️ 昵称已存在:', nicknameCheck.message);
          return;
        }
        
        if (nicknameCheck.error) {
          // 检查过程中发生错误
          notification.error({
            message: '❌ 检查失败',
            description: `💔 ${nicknameCheck.error}`,
            placement: 'topRight',
            duration: 5,
          });
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
          setIsMessagesLoading(true); // 进入聊天后先显示消息加载中
          
          // 显示成功提示
          notification.success({
            message: '🎊 加入成功',
            description: `🌟 欢迎 ${user.nickname} 进入聊天室！`,
            placement: 'topRight',
            duration: 4,
          });
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
          notification.error({
            message: '💥 加入失败',
            description: '😢 加入聊天室失败，请重试',
            placement: 'topRight',
            duration: 5,
          });
          console.error('❌ 加入聊天室失败');
        }
      } catch (error) {
        console.error('❌ 加入聊天室过程中发生错误:', error);
        notification.error({
          message: '💥 加入失败',
          description: '😢 加入聊天室时发生错误，请重试',
          placement: 'topRight',
          duration: 5,
        });
      } finally {
        // 无论成功还是失败，都要取消loading状态
        setIsJoining(false);
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

      // 构造本地待确认消息（乐观更新）
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const pendingMsg = {
        id: tempId,
        userId: userInfo.id,
        nickname: userInfo.nickname,
        message: messageText,
        timestamp: Date.now(),
        isPending: true
      };

      // 立即在本地显示消息并清空输入框
      setMessages(prev => [...prev, pendingMsg]);
      setCurrentMessage('');
      scrollToBottom();

      const success = await chatAPI.current.sendMessage(messageText);

      if (success) {
        console.log('✅ 消息发送成功');
        // 成功后等待服务端广播的正式消息覆盖本地列表；
        // 如果有延迟也可在此处移除 pending，但通常广播会很快到达
      } else {
        // 发送失败：移除本地 pending，恢复输入框
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setCurrentMessage(messageText);
        notification.error({
          message: '💥 发送失败',
          description: '😢 消息发送失败，请重试',
          placement: 'topRight',
          duration: 5,
        });
        console.error('❌ 消息发送失败');
      }
    } else {
      console.error('❌ 消息发送条件不满足:', {
        hasMessage: !!currentMessage.trim(),
        hasUserInfo: !!userInfo,
        isConnected: isConnected
      });
      notification.error({
        message: '💥 发送失败',
        description: '😢 消息发送失败，请重试',
        placement: 'topRight',
        duration: 5,
      });
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
              欢迎来到加密屏道
            </Title>
            <Input
              className="nickname-input"
              placeholder="请输入您的昵称"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onPressEnter={handleJoinChat}
              style={{
                marginBottom: 16,
                height: 52,
                padding: '10px 14px'
              }}
              prefix={<UserOutlined style={{ marginRight: 8 }} />}
            />
            <Button 
              type="primary" 
              block 
              className="nickname-join-btn"
              onClick={handleJoinChat}
              loading={isJoining}
              disabled={!nickname.trim() || isJoining}
            >
              {isJoining ? '正在加入...' : '加入加密屏道'}
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
              <span style={{ 
                background: 'linear-gradient(45deg, #00d4ff, #ff00d4, #00ff88)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: 'gradientShift 3s ease infinite',
                fontWeight: 'bold',
                textShadow: '0 0 20px rgba(0, 212, 255, 0.5)'
              }}>
                🔥 在线用户 {users.filter(user => user.id !== userInfo?.id).length + 1} 人
              </span>
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
            {isMessagesLoading ? (
              <div className="empty-chat">
                <Spin tip="消息加载中..." size="large" />
              </div>
            ) : messages.length === 0 ? (
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
