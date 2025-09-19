import React, { useState, useEffect, useRef } from 'react';
import { Layout, Input, Button, List, Avatar, Typography, Card, Space, message, Empty } from 'antd';
import { SendOutlined, UserOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { SocketContext } from '../contexts/SocketContext';
import UserCard from './UserCard';
import './ChatRoom.css';

const { Sider, Content } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;

function ChatRoom({ onStartVideo, localStream: parentLocalStream, remoteStream: parentRemoteStream, onStreamUpdate }) {
  const socket = React.useContext(SocketContext);
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
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
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
      
      // 获取新的完整媒体流
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
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
      
      // 获取音频流
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      
      // 如果有现有流，创建新流并添加所有轨道
      if (localStream) {
        const newStream = new MediaStream();
        
        // 添加现有的视频轨道
        localStream.getVideoTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            newStream.addTrack(track);
          }
        });
        
        // 添加新的音频轨道
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          newStream.addTrack(audioTrack);
        }
        
        setLocalStream(newStream);
        if (onStreamUpdate) {
          onStreamUpdate(newStream);
        }
      } else {
        setLocalStream(stream);
        if (onStreamUpdate) {
          onStreamUpdate(stream);
        }
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
      
      // 获取视频流
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      
      // 如果有现有流，创建新流并添加所有轨道
      if (localStream) {
        const newStream = new MediaStream();
        
        // 添加现有的音频轨道
        localStream.getAudioTracks().forEach(track => {
          if (track.readyState !== 'ended') {
            newStream.addTrack(track);
          }
        });
        
        // 添加新的视频轨道
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          newStream.addTrack(videoTrack);
        }
        
        setLocalStream(newStream);
        if (onStreamUpdate) {
          onStreamUpdate(newStream);
        }
      } else {
        setLocalStream(stream);
        if (onStreamUpdate) {
          onStreamUpdate(stream);
        }
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

  const handleToggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isAudioEnabled;
        setIsAudioEnabled(!isAudioEnabled);
        console.log('音频状态切换:', !isAudioEnabled ? '开启' : '关闭');
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        const newVideoState = !isVideoEnabled;
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
                <UserCard
                  key={user.id}
                  user={user}
                  isCurrentUser={user.id === userInfo?.id}
                  onToggleAudio={handleToggleAudio}
                  onToggleVideo={handleToggleVideo}
                  onEndCall={handleEndCall}
                  isAudioEnabled={isAudioEnabled}
                  isVideoEnabled={isVideoEnabled}
                  isInCall={isInCall}
                  localStream={user.id === userInfo?.id ? (localStream || parentLocalStream) : null}
                  remoteStream={user.id !== userInfo?.id ? parentRemoteStream : null}
                />
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
