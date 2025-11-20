import type { FC } from 'react';
import { Card } from 'antd';
import buddySvg from '../assets/buddy.svg';
import './SimpleUserCard.css';

interface BasicUser {
  id?: string;
  nickname?: string;
}

interface SimpleUserCardProps {
  user?: BasicUser | null;
  isCurrentUser?: boolean;
}

const SimpleUserCard: FC<SimpleUserCardProps> = ({ user, isCurrentUser = false }) => {
  return (
    <Card
      className={`simple-user-card ${isCurrentUser ? 'current-user' : ''}`}
      bodyStyle={{ padding: 0, height: '100%' }}
      bordered={false}
    >
      <div className="image-container">
        <img
          src={buddySvg}
          alt="用户头像"
          className="user-image"
        />
      </div>

      <div className="name-container">
        <div className="user-name">
          {user?.nickname || '未知用户'}
        </div>
      </div>
    </Card>
  );
};

export default SimpleUserCard;

