import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Button, Avatar, Typography, Space, Tooltip } from 'antd';
import { 
  UserOutlined, 
  AudioOutlined, 
  AudioMutedOutlined,
  VideoCameraOutlined, 
  VideoCameraAddOutlined,
  PhoneOutlined
} from '@ant-design/icons';
import buddySvg from '../assets/buddy.svg';
import './UserCard.css';

// 使用内联SVG的组件 - 铺满整个视频区域
const UserLogo = () => {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#2a2a2a'
    }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 48 48"
        style={{
          width: '100%',
          height: '100%',
          opacity: 0.8
        }}
      >
        <path
          d="m 29.874052,1037.8071 c -0.170513,-1.8828 -0.105106,-3.1968 -0.105106,-4.917 0.852576,-0.4474 2.380226,-3.2994 2.638334,-5.7089 0.670389,-0.054 1.727363,-0.7089 2.036865,-3.2912 0.167015,-1.3862 -0.496371,-2.1665 -0.900473,-2.4118 1.090848,-3.2807 3.356621,-13.4299 -4.190513,-14.4788 -0.776672,-1.364 -2.765648,-2.0544 -5.350262,-2.0544 -10.340807,0.1905 -11.588155,7.8088 -9.321205,16.5332 -0.402943,0.2453 -1.066322,1.0256 -0.900475,2.4118 0.310672,2.5823 1.366476,3.2362 2.036857,3.2912 0.256949,2.4083 1.845322,5.2615 2.700243,5.7089 0,1.7202 0.06426,3.0342 -0.106272,4.917 -2.046213,5.5007 -15.8522501,3.9567 -16.4899366,14.5661 H 46.303254 c -0.636524,-10.6094 -14.38299,-9.0654 -16.429202,-14.5661 z"
          transform="translate(0, -1004.3622)"
          style={{ opacity: 0.5 }}
        />
      </svg>
    </div>
  );
};

const { Text } = Typography;

function UserCard({ 
  user, 
  isCurrentUser = false, 
  onToggleAudio, 
  onToggleVideo, 
  onEndCall,
  isAudioEnabled = true,
  isVideoEnabled = true,
  isInCall = false,
  localStream = null,
  remoteStream = null
}) {
  const [position, setPosition] = useState(isCurrentUser ? { x: 20, y: window.innerHeight - 500 } : null);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // 更新视频流
  useEffect(() => {
    if (videoRef.current && isCurrentUser && localStream) {
      videoRef.current.srcObject = localStream;
    } else if (videoRef.current && !isCurrentUser && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [localStream, remoteStream, isCurrentUser]);

  // 简单的拖拽处理函数
  const handleMouseDown = useCallback((e) => {
    if (!isCurrentUser) return; // 只有当前用户才能拖拽
    
    // 检查是否点击在按钮上
    if (e.target.closest('.control-btn') || e.target.closest('.ant-btn')) {
      return; // 不处理按钮点击
    }
    
    console.log('开始拖拽', { x: e.clientX, y: e.clientY, position });
    
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); // 阻止事件冒泡到其他元素
    
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    
    setIsDragging(true);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    
    // 临时提高z-index确保在最上层
    if (cardRef.current) {
      cardRef.current.style.zIndex = '99999';
    }
    
    // 临时禁用聊天区域的事件处理
    const chatContent = document.querySelector('.chat-content');
    const messagesContainer = document.querySelector('.messages-container');
    if (chatContent) {
      chatContent.style.pointerEvents = 'none';
    }
    if (messagesContainer) {
      messagesContainer.style.pointerEvents = 'none';
    }
  }, [isCurrentUser, position.x, position.y]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    // 限制在视窗内，但不能超出在线用户区域（70%宽度）
    const cardSize = 280; // 正方形卡片，整体调小一圈
    const cardWidth = cardSize;
    const cardHeight = cardSize;
    const userAreaWidth = window.innerWidth * 0.7; // 70%宽度
    const maxX = userAreaWidth - cardWidth;
    const maxY = window.innerHeight - cardHeight;
    
    let finalX = Math.max(0, Math.min(newX, maxX));
    let finalY = Math.max(0, Math.min(newY, maxY));
    
    // 添加吸附效果
    const snapThreshold = 50;
    
    // 左边界吸附
    if (finalX < snapThreshold) {
      finalX = 0;
    }
    
    // 右边界吸附
    if (finalX > maxX - snapThreshold) {
      finalX = maxX;
    }
    
    // 上边界吸附
    if (finalY < snapThreshold) {
      finalY = 0;
    }
    
    // 下边界吸附
    if (finalY > maxY - snapThreshold) {
      finalY = maxY;
    }
    
    // 使用requestAnimationFrame实现平滑过渡
    requestAnimationFrame(() => {
      setPosition({ x: finalX, y: finalY });
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    console.log('结束拖拽');
    setIsDragging(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // 恢复z-index
    if (cardRef.current) {
      cardRef.current.style.zIndex = '';
    }
    
    // 恢复聊天区域的事件处理
    const chatContent = document.querySelector('.chat-content');
    const messagesContainer = document.querySelector('.messages-container');
    if (chatContent) {
      chatContent.style.pointerEvents = 'auto';
    }
    if (messagesContainer) {
      messagesContainer.style.pointerEvents = 'auto';
    }
  }, []);

  // 触摸事件
  const handleTouchStart = useCallback((e) => {
    if (!isCurrentUser) return; // 只有当前用户才能拖拽
    
    // 检查是否点击在按钮上
    if (e.target.closest('.control-btn') || e.target.closest('.ant-btn')) {
      return; // 不处理按钮点击
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    dragOffset.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
    
    setIsDragging(true);
    document.body.style.userSelect = 'none';
    
    // 临时禁用聊天区域的事件处理
    const chatContent = document.querySelector('.chat-content');
    const messagesContainer = document.querySelector('.messages-container');
    if (chatContent) {
      chatContent.style.pointerEvents = 'none';
    }
    if (messagesContainer) {
      messagesContainer.style.pointerEvents = 'none';
    }
  }, [isCurrentUser, position.x, position.y]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const touch = e.touches[0];
    
    const newX = touch.clientX - dragOffset.current.x;
    const newY = touch.clientY - dragOffset.current.y;
    
    // 限制在视窗内，但不能超出在线用户区域（70%宽度）
    const cardSize = 280; // 正方形卡片，整体调小一圈
    const cardWidth = cardSize;
    const cardHeight = cardSize;
    const userAreaWidth = window.innerWidth * 0.7; // 70%宽度
    const maxX = userAreaWidth - cardWidth;
    const maxY = window.innerHeight - cardHeight;
    
    let finalX = Math.max(0, Math.min(newX, maxX));
    let finalY = Math.max(0, Math.min(newY, maxY));
    
    // 添加吸附效果
    const snapThreshold = 50;
    
    // 左边界吸附
    if (finalX < snapThreshold) {
      finalX = 0;
    }
    
    // 右边界吸附
    if (finalX > maxX - snapThreshold) {
      finalX = maxX;
    }
    
    // 上边界吸附
    if (finalY < snapThreshold) {
      finalY = 0;
    }
    
    // 下边界吸附
    if (finalY > maxY - snapThreshold) {
      finalY = maxY;
    }
    
    // 使用requestAnimationFrame实现平滑过渡
    requestAnimationFrame(() => {
      setPosition({ x: finalX, y: finalY });
    });
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = '';
    
    // 恢复聊天区域的事件处理
    const chatContent = document.querySelector('.chat-content');
    const messagesContainer = document.querySelector('.messages-container');
    if (chatContent) {
      chatContent.style.pointerEvents = 'auto';
    }
    if (messagesContainer) {
      messagesContainer.style.pointerEvents = 'auto';
    }
  }, []);

  // 全局事件监听
  useEffect(() => {
    if (isDragging) {
      // 使用capture阶段捕获事件，确保优先处理
      document.addEventListener('mousemove', handleMouseMove, { passive: false, capture: true });
      document.addEventListener('mouseup', handleMouseUp, { capture: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
      document.addEventListener('touchend', handleTouchEnd, { capture: true });
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove, { capture: true });
        document.removeEventListener('mouseup', handleMouseUp, { capture: true });
        document.removeEventListener('touchmove', handleTouchMove, { capture: true });
        document.removeEventListener('touchend', handleTouchEnd, { capture: true });
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // 清理函数
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, []);

  const cardStyle = {
    position: isCurrentUser ? 'fixed' : 'relative',
    left: isCurrentUser ? position.x : undefined,
    top: isCurrentUser ? position.y : undefined,
    zIndex: isCurrentUser ? (isDragging ? 99999 : 1000) : 1,
    cursor: isCurrentUser ? (isDragging ? 'grabbing' : 'grab') : 'default',
    userSelect: 'none',
    width: '280px', // 正方形卡片，整体调小一圈
    height: '280px', // 正方形卡片，整体调小一圈
    // 确保拖拽时在最上层
    pointerEvents: isDragging ? 'auto' : 'auto',
    // 强制覆盖所有圆角和边框
    borderRadius: '0px !important',
    border: 'none !important',
    outline: 'none !important'
  };

  return (
    <Card
      ref={cardRef}
      className={`user-card ${isCurrentUser ? 'current-user' : 'other-user'} ${isDragging ? 'dragging' : ''}`}
      style={{
        ...cardStyle,
        borderRadius: '0px !important'
      }}
      size="small"
      bodyStyle={{ 
        padding: 0, 
        height: '100%',
        borderRadius: '0px !important'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* 视频区域 - 占据80% */}
      <div className="video-container">
        {isVideoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            muted={isCurrentUser}
            playsInline
            className="user-video"
          />
        ) : (
          <div className="video-placeholder">
            <UserLogo />
            <Text className="placeholder-text">{user?.nickname || '未知用户'}</Text>
          </div>
        )}
        
        {isCurrentUser && (
          <div className="drag-handle">
            <div className="drag-dots">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>
      
      {/* 控制区域 - 占据20% */}
      <div className="controls-container">
        {isCurrentUser ? (
          <div className="current-user-controls">
            <Space size="middle">
              {/* 始终显示控制按钮，不依赖isInCall状态 */}
                      <Tooltip title={isAudioEnabled ? '静音' : '取消静音'}>
                        <div
                          className={`pure-icon-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
                          onClick={onToggleAudio}
                        >
                          {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                        </div>
                      </Tooltip>
                      
                      <Tooltip title={isVideoEnabled ? '关闭视频' : '开启视频'}>
                        <div
                          className={`pure-icon-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
                          onClick={onToggleVideo}
                        >
                          {isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                        </div>
                      </Tooltip>
                      
                      {isInCall && (
                        <Tooltip title="结束通话">
                          <div
                            className="pure-icon-btn call-btn"
                            onClick={onEndCall}
                          >
                            <PhoneOutlined />
                          </div>
                        </Tooltip>
                      )}
            </Space>
          </div>
                ) : (
                  <div className="other-user-controls">
                    <Space size="middle">
                      {/* 其他用户的控制按钮 - 只显示状态，不可点击 */}
                      <div className={`status-indicator ${isAudioEnabled ? 'enabled' : 'disabled'}`}>
                        {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                      </div>
                      
                      <div className={`status-indicator ${isVideoEnabled ? 'enabled' : 'disabled'}`}>
                        {isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                      </div>
                      
                      {isInCall && (
                        <div className="status-indicator call-status">
                          <PhoneOutlined />
                        </div>
                      )}
                    </Space>
                  </div>
                )}
      </div>
    </Card>
  );
}

export default UserCard;
