import React, { useRef, useEffect } from 'react';
import { Card, Typography } from 'antd';
import { AudioOutlined, AudioMutedOutlined, VideoCameraOutlined, VideoCameraAddOutlined } from '@ant-design/icons';
import buddySvg from '../assets/buddy.svg';
import './OtherUserCard.css';

const { Text } = Typography;

// 用户Logo组件 - 使用buddy.svg
const UserLogo = ({ nickname }) => {
  return (
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
  );
};

function OtherUserCard({ 
  user,
  isAudioEnabled = true,
  isVideoEnabled = true,
  remoteStream = null
}) {
  const videoRef = useRef(null);

  // 卡片尺寸
  const cardSize = 280;
  const cardWidth = cardSize;
  const cardHeight = cardSize;

  // 更新视频流
  useEffect(() => {
    if (videoRef.current && remoteStream && isVideoEnabled) {
      videoRef.current.srcObject = remoteStream;
    } else if (videoRef.current && !isVideoEnabled) {
      videoRef.current.srcObject = null;
    }
  }, [remoteStream, isVideoEnabled]);

  const cardStyle = {
    position: 'relative',
    width: cardWidth,
    height: cardHeight,
    border: 'none !important',
    outline: 'none !important',
    borderRadius: '0px !important',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease',
  };

  return (
    <Card
      className="other-user-card"
      style={cardStyle}
      size="small"
      styles={{
        body: {
          padding: 0, 
          height: '100%',
          borderRadius: '0px !important'
        }
      }}
    >
      {/* 视频区域 - 占据80% */}
      <div className="video-container">
        {remoteStream && isVideoEnabled ? (
          <video
            ref={videoRef}
            className="user-video"
            autoPlay
            muted
            playsInline
          />
        ) : (
          <UserLogo nickname={user?.nickname} />
        )}
      </div>
      
      {/* 状态区域 - 占据20% */}
      <div className="status-container">
        <div className="status-indicators">
          <div className={`status-icon audio-status ${isAudioEnabled ? 'enabled' : 'disabled'}`}>
            {isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
          </div>
          
          <div className={`status-icon video-status ${isVideoEnabled ? 'enabled' : 'disabled'}`}>
            {isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
          </div>
        </div>
        
        <div className="user-info">
          <Text className="user-nickname">{user?.nickname}</Text>
        </div>
      </div>
    </Card>
  );
}

export default OtherUserCard;
