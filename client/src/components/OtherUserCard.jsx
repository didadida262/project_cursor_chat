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
    console.log('📹 OtherUserCard useEffect - 用户:', user?.nickname, 'remoteStream:', !!remoteStream, 'isVideoEnabled:', isVideoEnabled);
    
    if (videoRef.current && remoteStream && isVideoEnabled) {
      console.log('🎬 设置远程视频流到video元素');
      console.log('视频元素:', videoRef.current);
      console.log('远程流轨道:', remoteStream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState,
        id: track.id,
        muted: track.muted
      })));
      
      // 检查视频轨道
      const videoTrack = remoteStream.getVideoTracks()[0];
      if (videoTrack) {
        console.log('🎥 视频轨道详情:', {
          id: videoTrack.id,
          label: videoTrack.label,
          enabled: videoTrack.enabled,
          readyState: videoTrack.readyState,
          muted: videoTrack.muted,
          settings: videoTrack.getSettings()
        });
      } else {
        console.warn('⚠️ 没有找到视频轨道！');
      }
      
      videoRef.current.srcObject = remoteStream;
      
      // 检查视频元素状态
      console.log('🎥 视频元素设置后状态:', {
        srcObject: !!videoRef.current.srcObject,
        readyState: videoRef.current.readyState,
        paused: videoRef.current.paused,
        muted: videoRef.current.muted,
        autoplay: videoRef.current.autoplay,
        playsInline: videoRef.current.playsInline,
        currentSrc: videoRef.current.currentSrc,
        networkState: videoRef.current.networkState,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight,
        streamId: remoteStream?.id,
        streamActive: remoteStream?.active
      });
      
      // 不要调用load()，直接尝试播放
      // videoRef.current.load(); // 移除这个调用，它会中断播放
      
      // 等待一下让视频元素处理srcObject
      setTimeout(() => {
        console.log('🎥 延迟后视频状态:', {
          readyState: videoRef.current.readyState,
          paused: videoRef.current.paused,
          networkState: videoRef.current.networkState
        });
        
        // 如果视频还是没有开始加载，尝试手动触发
        if (videoRef.current.readyState === 0) {
          console.log('🔧 视频元素readyState仍为0，尝试手动触发加载');
          // 不调用load()，而是重新设置srcObject
          const currentStream = videoRef.current.srcObject;
          videoRef.current.srcObject = null;
          setTimeout(() => {
            videoRef.current.srcObject = currentStream;
            console.log('🔧 重新设置srcObject完成');
          }, 50);
        }
      }, 100);
      
      // 尝试播放视频 - 处理浏览器的自动播放限制
      const attemptPlay = async () => {
        try {
          await videoRef.current.play();
          console.log('✅ 视频播放成功');
        } catch (error) {
          console.error('❌ 视频播放失败:', error);
          console.log('🔧 尝试其他播放方式...');
          
          // 如果自动播放失败，尝试其他方式
          if (error.name === 'NotAllowedError') {
            console.log('🚫 浏览器阻止了自动播放，需要用户交互');
            // 添加点击事件来手动播放
            const playOnClick = () => {
              videoRef.current.play().then(() => {
                console.log('✅ 用户交互后视频播放成功');
                document.removeEventListener('click', playOnClick);
                document.removeEventListener('touchstart', playOnClick);
              }).catch(e => {
                console.error('❌ 用户交互后仍然播放失败:', e);
              });
            };
            
            document.addEventListener('click', playOnClick);
            document.addEventListener('touchstart', playOnClick);
          }
        }
      };
      
      attemptPlay();
      
      // 延迟再次尝试播放（处理异步加载）
      setTimeout(() => {
        if (videoRef.current && videoRef.current.paused && videoRef.current.readyState > 0) {
          console.log('🔄 延迟重试播放...');
          attemptPlay();
        }
      }, 1000);
      
      // 添加事件监听器来调试视频加载
      const handleLoadedMetadata = () => {
        console.log('✅ 视频元数据加载完成');
        console.log('✅ 视频尺寸:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
        console.log('✅ 视频时长:', videoRef.current?.duration);
        console.log('✅ 视频当前时间:', videoRef.current?.currentTime);
        console.log('✅ 视频播放状态:', videoRef.current?.paused ? '暂停' : '播放中');
      };
      
      const handleLoadedData = () => {
        console.log('✅ 视频数据加载完成');
        console.log('✅ 数据加载后状态:', {
          readyState: videoRef.current?.readyState,
          paused: videoRef.current?.paused,
          networkState: videoRef.current?.networkState
        });
      };
      
      const handleCanPlay = () => {
        console.log('✅ 视频可以播放');
        console.log('✅ 可播放状态:', {
          readyState: videoRef.current?.readyState,
          paused: videoRef.current?.paused,
          muted: videoRef.current?.muted,
          autoplay: videoRef.current?.autoplay,
          srcObject: !!videoRef.current?.srcObject,
          currentTime: videoRef.current?.currentTime
        });
        
        // 如果可以播放但仍在暂停，尝试播放
        if (videoRef.current?.paused && videoRef.current.readyState >= 2) {
          console.log('🔄 视频可播放但仍在暂停，尝试播放...');
          videoRef.current.play().then(() => {
            console.log('✅ 自动播放成功');
          }).catch(error => {
            console.error('❌ 自动播放失败:', error);
          });
        }
      };
      
      const handleError = (e) => {
        console.error('❌ 视频加载错误:', e);
        console.error('视频错误详情:', videoRef.current?.error);
      };
      
      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoRef.current.addEventListener('loadeddata', handleLoadedData);
      videoRef.current.addEventListener('canplay', handleCanPlay);
      videoRef.current.addEventListener('error', handleError);
      
      // 清理事件监听器
      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current?.removeEventListener('loadeddata', handleLoadedData);
        videoRef.current?.removeEventListener('canplay', handleCanPlay);
        videoRef.current?.removeEventListener('error', handleError);
      };
    } else if (videoRef.current && !isVideoEnabled) {
      console.log('🧹 清空视频流');
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
        <video
          ref={videoRef}
          className="user-video"
          autoPlay
          muted
          playsInline
          controls={false}
          preload="none"
          crossOrigin="anonymous"
            onClick={() => {
              console.log('🎬 用户点击视频元素');
              if (videoRef.current) {
                console.log('🎬 点击视频前状态:', {
                  readyState: videoRef.current.readyState,
                  paused: videoRef.current.paused,
                  muted: videoRef.current.muted,
                  srcObject: !!videoRef.current.srcObject
                });
                
                if (videoRef.current.paused) {
                  console.log('🎬 视频暂停中，尝试播放');
                  videoRef.current.play().then(() => {
                    console.log('✅ 点击视频播放成功');
                  }).catch(error => {
                    console.error('❌ 点击视频播放失败:', error);
                    console.error('❌ 错误详情:', {
                      name: error.name,
                      message: error.message,
                      code: error.code
                    });
                  });
                } else {
                  console.log('🎬 视频已在播放中');
                }
              } else {
                console.error('❌ videoRef.current 为空');
              }
            }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000',
                border: '2px solid red', // 临时添加红色边框来调试
                cursor: 'pointer',
                position: 'relative',
              }}
            />
            {/* 添加播放提示覆盖层 - 只在视频暂停时显示 */}
            {remoteStream && isVideoEnabled && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '5px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  zIndex: 10
                }}
                onClick={() => {
                  console.log('🎬 用户点击播放提示，尝试播放');
                  if (videoRef.current) {
                    console.log('🎬 播放前视频状态:', {
                      readyState: videoRef.current.readyState,
                      paused: videoRef.current.paused,
                      muted: videoRef.current.muted,
                      srcObject: !!videoRef.current.srcObject,
                      currentSrc: videoRef.current.currentSrc,
                      networkState: videoRef.current.networkState
                    });
                    
                    // 直接尝试播放，不要调用load()
                    videoRef.current.play().then(() => {
                      console.log('✅ 点击播放提示后播放成功');
                      console.log('✅ 播放后视频状态:', {
                        readyState: videoRef.current.readyState,
                        paused: videoRef.current.paused,
                        currentTime: videoRef.current.currentTime
                      });
                    }).catch(error => {
                      console.error('❌ 点击播放提示后播放失败:', error);
                      console.error('❌ 错误详情:', {
                        name: error.name,
                        message: error.message,
                        code: error.code
                      });
                      
                      // 如果是自动播放被阻止，尝试其他方法
                      if (error.name === 'NotAllowedError') {
                        console.log('🚫 浏览器阻止自动播放，尝试设置muted播放');
                        videoRef.current.muted = true;
                        videoRef.current.play().then(() => {
                          console.log('✅ 静音播放成功');
                        }).catch(e => {
                          console.error('❌ 静音播放也失败:', e);
                        });
                      }
                    });
                  } else {
                    console.error('❌ videoRef.current 为空');
                  }
                }}
              >
                🎬 点击播放视频
              </div>
            )}
            {/* 当没有视频流时显示用户logo */}
            {!remoteStream && <UserLogo nickname={user?.nickname} />}
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
