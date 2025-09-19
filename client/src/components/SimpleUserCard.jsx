import React from 'react';
import { Card } from 'antd';
import buddySvg from '../assets/buddy.svg';
import './SimpleUserCard.css';

const SimpleUserCard = ({ user, isCurrentUser = false }) => {
  // 卡片尺寸 - 与之前版本保持一致
  const cardSize = 280;
  const cardWidth = cardSize;
  const cardHeight = cardSize;

  const cardStyle = {
    position: 'relative',
    width: cardWidth,
    height: cardHeight,
    borderRadius: '0px !important',
    border: 'none !important',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    transition: 'all 0.3s ease',
  };

  return (
    <Card
      className={`simple-user-card ${isCurrentUser ? 'current-user' : ''}`}
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
      {/* 上半部分 - 显示buddy图片，占据80% */}
      <div className="image-container">
        <img
          src={buddySvg}
          alt="用户头像"
          className="user-image"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#2a2a2a'
          }}
        />
      </div>
      
      {/* 下半部分 - 显示用户名称，占据20% */}
      <div className="name-container">
        <div className="user-name">
          {user?.nickname || '未知用户'}
        </div>
      </div>
    </Card>
  );
};

export default SimpleUserCard;
