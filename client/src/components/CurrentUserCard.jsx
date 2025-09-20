import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, Typography } from 'antd';
import { AudioOutlined, AudioMutedOutlined, VideoCameraOutlined, VideoCameraAddOutlined } from '@ant-design/icons';
import buddySvg from '../assets/buddy.svg';
import './CurrentUserCard.css';

const { Text } = Typography;

// 用户Logo组件 - 使用buddy.svg

function CurrentUserCard({ 
  user,
  onToggleAudio, 
  onToggleVideo,
  isAudioEnabled = true,
  isVideoEnabled = true,
  localStream = null
}) {
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 500 });
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // 卡片尺寸
  const cardSize = 280;
  const cardWidth = cardSize;
  const cardHeight = cardSize;

  // 更新视频流
  useEffect(() => {
    if (videoRef.current && localStream && isVideoEnabled) {
      videoRef.current.srcObject = localStream;
    } else if (videoRef.current && !isVideoEnabled) {
      videoRef.current.srcObject = null;
    }
  }, [localStream, isVideoEnabled]);

  // 拖拽开始
  const handleMouseDown = useCallback((e) => {
    // 检查是否点击在按钮上
    if (e.target.closest('.control-btn') || e.target.closest('.ant-btn')) {
      return; // 不处理按钮点击
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
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
  }, [position.x, position.y]);

  // 拖拽移动
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragOffset.current || dragOffset.current.x === undefined || dragOffset.current.y === undefined) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    // 限制在视窗内，但不能超出在线用户区域（70%宽度）
    const userAreaWidth = window.innerWidth * 0.7;
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
    
    setPosition({ x: finalX, y: finalY });
  }, [isDragging, cardWidth, cardHeight]);

  // 拖拽结束
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // 恢复z-index
    if (cardRef.current) {
      cardRef.current.style.zIndex = '1000';
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
    // 检查是否点击在按钮上
    if (e.target.closest('.control-btn') || e.target.closest('.ant-btn')) {
      return;
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
  }, [position.x, position.y]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !dragOffset.current || dragOffset.current.x === undefined || dragOffset.current.y === undefined) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    const touch = e.touches[0];
    
    const newX = touch.clientX - dragOffset.current.x;
    const newY = touch.clientY - dragOffset.current.y;
    
    // 限制在视窗内，但不能超出在线用户区域（70%宽度）
    const userAreaWidth = window.innerWidth * 0.7;
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
    
    setPosition({ x: finalX, y: finalY });
  }, [isDragging, cardWidth, cardHeight]);

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

  // 添加全局事件监听器
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const cardStyle = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    width: cardWidth,
    height: cardHeight,
    cursor: 'move',
    zIndex: isDragging ? 99999 : 1000,
    border: 'none !important',
    outline: 'none !important',
    borderRadius: '0px !important',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out',
    transform: isDragging ? 'translateZ(0)' : undefined,
    willChange: isDragging ? 'transform' : undefined,
  };

  return (
    <Card
      ref={cardRef}
      className={`current-user-card ${isDragging ? 'dragging' : ''}`}
      style={{
        ...cardStyle,
        borderRadius: '0px !important'
      }}
      size="small"
      styles={{
        body: {
          padding: 0, 
          height: '100%',
          borderRadius: '0px !important'
        }
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* 视频区域 - 占据80% */}
      <div className="video-container">
        {localStream && isVideoEnabled ? (
          <video
            ref={videoRef}
            className="user-video"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <div className="video-placeholder">
            <img 
              src={buddySvg} 
              alt="User Avatar" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        )}
      </div>
      
      {/* 控制区域 - 占据20% */}
      <div className="controls-container">
        <div className="control-buttons">
          <button
            className={`control-btn audio-btn ${isAudioEnabled ? 'enabled' : 'disabled'}`}
            onClick={onToggleAudio}
            title={isAudioEnabled ? '关闭麦克风' : '开启麦克风'}
          >
            {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
          </button>
          
          <button
            className={`control-btn video-btn ${isVideoEnabled ? 'enabled' : 'disabled'}`}
            onClick={onToggleVideo}
            title={isVideoEnabled ? '关闭摄像头' : '开启摄像头'}
          >
            {isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
          </button>
        </div>
        
        <div className="user-info">
          <Text className="user-nickname">{user?.nickname || '我'}</Text>
        </div>
      </div>
    </Card>
  );
}

export default CurrentUserCard;
