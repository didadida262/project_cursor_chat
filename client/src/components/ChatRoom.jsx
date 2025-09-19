import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, List, Avatar, Typography, Card, Space, Empty, App } from 'antd';
import { SendOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { SocketContext } from '../contexts/SocketContext';
import CurrentUserCard from './CurrentUserCard';
import OtherUserCard from './OtherUserCard';
import mediaCoordinator from '../utils/MediaCoordinator';
import './ChatRoom.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

function ChatRoom({ onStartVideo, localStream: parentLocalStream, remoteStream: parentRemoteStream, onStreamUpdate }) {
  const socket = React.useContext(SocketContext);
  const { message } = App.useApp();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [nickname, setNickname] = useState('');
  const messagesEndRef = useRef(null);
  const [showNicknameInput, setShowNicknameInput] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isInCall, setIsInCall] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [hasRequestedMedia, setHasRequestedMedia] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 清理本地流
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (localStream) {
        mediaCoordinator.stopMediaStream(localStream);
      }
      mediaCoordinator.releaseMedia();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [localStream]);

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


  // 请求媒体流
  const requestMediaStream = async (type = 'both') => {
    try {
      let loadingText = '正在获取音视频权限...';
      let successText = '音视频权限获取成功';
      
      if (type === 'audio') {
        loadingText = '正在获取音频权限...';
        successText = '音频权限获取成功';
      } else if (type === 'video') {
        loadingText = '正在获取视频权限...';
        successText = '视频权限获取成功';
      }
      
      message.loading(loadingText, 0);
      
      // 停止旧的流（如果存在）
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      
      // 使用MediaCoordinator获取媒体流
      const constraints = {
        video: type === 'video' || type === 'both',
        audio: type === 'audio' || type === 'both'
      };
      
      const stream = await mediaCoordinator.requestMediaAccess(constraints);
      
      setLocalStream(stream);
      if (onStreamUpdate) {
        onStreamUpdate(stream);
      }
      
      message.destroy();
      message.success(successText);
    } catch (error) {
      message.destroy();
      console.error('获取媒体流失败:', error);
      message.error('获取音视频权限失败，请检查设备权限');
    }
  };

  // 请求音频流
  const requestAudioStream = async () => {
    try {
      message.loading('正在获取音频权限...', 0);
      
      // 使用MediaCoordinator获取音频流
      const stream = await mediaCoordinator.requestMediaAccess({
        audio: true,
        video: false
      });
      
      setLocalStream(stream);
      if (onStreamUpdate) {
        onStreamUpdate(stream);
      }
      
      message.destroy();
      message.success('音频权限获取成功');
    } catch (error) {
      message.destroy();
      console.error('获取音频流失败:', error);
      message.error('获取音频权限失败，请检查设备权限');
    }
  };

  // 请求视频流
  const requestVideoStream = async () => {
    try {
      message.loading('正在获取视频权限...', 0);
      
      // 使用MediaCoordinator获取视频流
      const stream = await mediaCoordinator.requestMediaAccess({
        video: true,
        audio: false
      });
      
      setLocalStream(stream);
      if (onStreamUpdate) {
        onStreamUpdate(stream);
      }
      
      message.destroy();
      message.success('视频权限获取成功');
    } catch (error) {
      message.destroy();
      console.error('获取视频流失败:', error);
      message.error('获取视频权限失败，请检查设备权限');
    }
  };

  const handleJoinChat = async () => {
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
    
    // 自动请求音视频权限
    if (!hasRequestedMedia) {
      setHasRequestedMedia(true);
      console.log('首次请求媒体流...');
      await requestMediaStream();
    }
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

  const handleToggleAudio = async () => {
    const newAudioState = !isAudioEnabled;
    
    if (newAudioState && (!localStream || localStream.getAudioTracks().length === 0)) {
      // 如果没有音频流，重新获取
      await requestMediaStream('audio');
    } else if (localStream) {
      // 如果有音频流，直接切换状态
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = newAudioState;
        setIsAudioEnabled(newAudioState);
        console.log('音频状态切换:', newAudioState ? '开启' : '关闭');
      }
    }
  };

  const handleToggleVideo = async () => {
    const newVideoState = !isVideoEnabled;
    
    if (newVideoState && (!localStream || localStream.getVideoTracks().length === 0)) {
      // 如果没有视频流，重新获取
      await requestMediaStream('video');
    } else if (localStream) {
      // 如果有视频流，直接切换状态
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = newVideoState;
        setIsVideoEnabled(newVideoState);
        console.log('视频状态切换:', newVideoState ? '开启' : '关闭');
        console.log('视频轨道状态:', videoTrack.readyState, 'enabled:', videoTrack.enabled);
      }
    }
  };

  const handleEndCall = () => {
    console.log('结束通话');
    setIsInCall(false);
    setIsAudioEnabled(true);
    setIsVideoEnabled(true);
    // 这里可以添加结束通话的逻辑
  };



  const handleStartVideoCall = () => {
    setIsInCall(true);
    onStartVideo();
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
      <Sider width="70%" className="user-sidebar">
        <div className="sidebar-header">
          <Title level={4}>在线用户 ({users.length})</Title>
        </div>
        <div className="users-list">
          {users.length > 0 ? (
            <div className="users-grid">
              {users.map((user) => (
                user.id === userInfo?.id ? (
                  <CurrentUserCard
                    key={user.id}
                    user={user}
                    onToggleAudio={handleToggleAudio}
                    onToggleVideo={handleToggleVideo}
                    isAudioEnabled={isAudioEnabled}
                    isVideoEnabled={isVideoEnabled}
                    localStream={localStream || parentLocalStream}
                  />
                ) : (
                  <OtherUserCard
                    key={user.id}
                    user={user}
                    isAudioEnabled={user.isAudioEnabled || true}
                    isVideoEnabled={user.isVideoEnabled || true}
                    remoteStream={parentRemoteStream}
                  />
                )
              ))}
            </div>
          ) : (
            <Empty 
              description="暂无在线用户"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="empty-users"
            />
          )}
        </div>
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
            </Space.Compact>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default ChatRoom;
