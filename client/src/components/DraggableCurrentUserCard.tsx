// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from 'antd';
import buddySvg from '../assets/buddy.svg';
import './DraggableCurrentUserCard.css';

const USER_AREA_RATIO = 0.7;
const GRID_COLUMNS = 5;
const GRID_GAP = 16;
const MIN_CARD_SIZE = 140;
const MAX_CARD_SIZE = 260;

const getSuggestedCardSize = () => {
  if (typeof window === 'undefined') {
    return 220;
  }
  const userAreaWidth = window.innerWidth * USER_AREA_RATIO;
  const availableWidth = userAreaWidth - GRID_GAP * (GRID_COLUMNS - 1);
  const rawSize = availableWidth / GRID_COLUMNS;
  return Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, rawSize));
};

const getInitialPosition = (size: number) => {
  if (typeof window === 'undefined') {
    return { x: 20, y: 20 };
  }
  const safeBottomGap = 40;
  return {
    x: 20,
    y: Math.max(20, window.innerHeight - size - safeBottomGap)
  };
};

const clampPositionToBounds = (pos: { x: number; y: number }, size: number) => {
  if (typeof window === 'undefined') {
    return pos;
  }
  const userAreaWidth = window.innerWidth * USER_AREA_RATIO;
  const maxX = Math.max(0, userAreaWidth - size);
  const maxY = Math.max(0, window.innerHeight - size);
  return {
    x: Math.min(Math.max(0, pos.x), maxX),
    y: Math.min(Math.max(0, pos.y), maxY)
  };
};

const DraggableCurrentUserCard = ({ user }) => {
  const [cardSize, setCardSize] = useState(() => getSuggestedCardSize());
  const [position, setPosition] = useState(() => getInitialPosition(getSuggestedCardSize())); // 初始位置在左下角
  const [isDragging, setIsDragging] = useState(false);
  const [isNearEdge, setIsNearEdge] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  
  // 组件挂载时初始化
  useEffect(() => {
    const boundaries = getBoundaries();
    console.log('🚀 组件挂载 - 边界信息:', boundaries);
  }, []);
  
  // console.log('🎯 当前状态:', { position, isDragging });

  // 卡片尺寸
  const cardWidth = cardSize;
  const cardHeight = cardSize;

  useEffect(() => {
    const handleResize = () => {
      const nextSize = getSuggestedCardSize();
      setCardSize(nextSize);
      setPosition(prev => clampPositionToBounds(prev, nextSize));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 拖拽边界计算
  const getBoundaries = () => {
    const userAreaWidth = window.innerWidth * USER_AREA_RATIO; // 限制在用户区域（70%宽度）
    const boundaries = {
      minX: 0, // 从最左边开始
      maxX: userAreaWidth - cardWidth, // 到用户区域右边界减去卡片宽度
      minY: 0, // 从最上面开始（包括头部区域）
      maxY: window.innerHeight - cardHeight // 到窗口底部
    };
    
    // 基本调试信息
    console.log('🎯 拖拽边界:', boundaries);
    
    return boundaries;
  };

  // 吸附到边界
  const snapToEdge = useCallback((x, y) => {
    const boundaries = getBoundaries();
    const snapThreshold = 50; // 增加吸附阈值，更容易触发

    let newX = x;
    let newY = y;
    let hasSnapped = false;

    // 水平吸附
    if (x <= boundaries.minX + snapThreshold) {
      newX = boundaries.minX;
      hasSnapped = true;
    } else if (x >= boundaries.maxX - snapThreshold) {
      newX = boundaries.maxX;
      hasSnapped = true;
    }

    // 垂直吸附
    if (y <= boundaries.minY + snapThreshold) {
      newY = boundaries.minY;
      hasSnapped = true;
    } else if (y >= boundaries.maxY - snapThreshold) {
      newY = boundaries.maxY;
      hasSnapped = true;
    }

    // 如果有吸附，输出日志
    if (hasSnapped) {
      console.log('🧲 吸附到边界:', { 
        原位置: { x, y }, 
        新位置: { x: newX, y: newY }
      });
    }

    return { x: newX, y: newY };
  }, []);

  // 鼠标按下事件
  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    const handleMouseMove = (moveEvent) => {
      if (!dragOffset.current || dragOffset.current.x === undefined || dragOffset.current.y === undefined) return;
      
      moveEvent.preventDefault();
      
      const boundaries = getBoundaries();
      const rawX = moveEvent.clientX - dragOffset.current.x;
      const rawY = moveEvent.clientY - dragOffset.current.y;
      
      // 限制在边界内
      const newX = Math.max(boundaries.minX, Math.min(boundaries.maxX, rawX));
      const newY = Math.max(boundaries.minY, Math.min(boundaries.maxY, rawY));
      
      
      // 检查是否接近边界（实时吸附提示）
      const snapThreshold = 50; // 与吸附函数使用相同的阈值
      const isNearLeft = newX <= boundaries.minX + snapThreshold;
      const isNearRight = newX >= boundaries.maxX - snapThreshold;
      const isNearTop = newY <= boundaries.minY + snapThreshold;
      const isNearBottom = newY >= boundaries.maxY - snapThreshold;
      
      const nearEdge = isNearLeft || isNearRight || isNearTop || isNearBottom;
      setIsNearEdge(nearEdge);
      
      if (nearEdge) {
        console.log('🔍 接近边界(鼠标):', { 
          position: { x: newX, y: newY },
          nearEdges: { left: isNearLeft, right: isNearRight, top: isNearTop, bottom: isNearBottom },
          threshold: snapThreshold
        });
      }
      
      // 直接更新位置
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsNearEdge(false);
      
      // 使用当前最新的位置进行吸附
      setPosition(currentPosition => {
        const snappedPosition = snapToEdge(currentPosition.x, currentPosition.y);
        return snappedPosition;
      });
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 触摸开始事件
  const handleTouchStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    dragOffset.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };

    const handleTouchMove = (moveEvent) => {
      if (!dragOffset.current || dragOffset.current.x === undefined || dragOffset.current.y === undefined) return;
      
      moveEvent.preventDefault();
      
      const touch = moveEvent.touches[0];
      const boundaries = getBoundaries();
      const rawX = touch.clientX - dragOffset.current.x;
      const rawY = touch.clientY - dragOffset.current.y;
      
      // 限制在边界内
      const newX = Math.max(boundaries.minX, Math.min(boundaries.maxX, rawX));
      const newY = Math.max(boundaries.minY, Math.min(boundaries.maxY, rawY));
      
      // 检查是否接近边界（实时吸附提示）
      const snapThreshold = 50; // 与吸附函数使用相同的阈值
      const isNearLeft = newX <= boundaries.minX + snapThreshold;
      const isNearRight = newX >= boundaries.maxX - snapThreshold;
      const isNearTop = newY <= boundaries.minY + snapThreshold;
      const isNearBottom = newY >= boundaries.maxY - snapThreshold;
      
      const nearEdge = isNearLeft || isNearRight || isNearTop || isNearBottom;
      setIsNearEdge(nearEdge);
      
      if (nearEdge) {
        console.log('🔍 接近边界(触摸):', { 
          position: { x: newX, y: newY },
          nearEdges: { left: isNearLeft, right: isNearRight, top: isNearTop, bottom: isNearBottom },
          threshold: snapThreshold
        });
      }
      
      // 直接更新位置
      setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setIsNearEdge(false);
      
      // 使用当前最新的位置进行吸附
      setPosition(currentPosition => {
        const snappedPosition = snapToEdge(currentPosition.x, currentPosition.y);
        return snappedPosition;
      });
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };


  const cardStyle = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    width: cardWidth,
    height: cardHeight,
    borderRadius: '0px !important',
    border: isNearEdge ? '2px solid #ff6b6b !important' : 'none !important', // 接近边界时显示红色边框
    boxShadow: isDragging 
      ? '0 8px 32px rgba(0, 150, 255, 0.4)' 
      : isNearEdge 
        ? '0 4px 20px rgba(255, 107, 107, 0.4)' // 接近边界时的红色阴影
        : '0 4px 20px rgba(0, 150, 255, 0.3)',
    transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: isDragging ? 'scale(1.02)' : 'scale(1)',
    zIndex: isDragging ? 1000 : 100,
    cursor: isDragging ? 'grabbing' : 'grab',
  };


  return (
    <Card
        className={`draggable-current-user-card ${isDragging ? 'dragging' : ''}`}
        style={cardStyle}
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
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
          {user?.nickname || '我'}
        </div>
      </div>
    </Card>
  );
};

export default DraggableCurrentUserCard;