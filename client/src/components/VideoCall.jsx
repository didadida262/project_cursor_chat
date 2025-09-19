import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Space, message, Typography } from 'antd';
import { 
  VideoCameraOutlined, 
  AudioOutlined, 
  AudioMutedOutlined,
  VideoCameraAddOutlined,
  PhoneOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { SocketContext } from '../contexts/SocketContext';
import './VideoCall.css';

const { Title, Text } = Typography;

function VideoCall({ onBack, onStreamUpdate }) {
  const socket = React.useContext(SocketContext);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [callStatus, setCallStatus] = useState('准备中...');
  const peerConnectionRef = useRef(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    if (!socket) return;

    // 初始化本地视频流
    initializeLocalStream();

    // Socket事件监听
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-started', handleCallStarted);
    socket.on('call-ended', handleCallEnded);
    socket.on('user-joined-call', handleUserJoinedCall);
    socket.on('user-left-call', handleUserLeftCall);

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('call-started');
      socket.off('call-ended');
      socket.off('user-joined-call');
      socket.off('user-left-call');
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [socket]);

  const initializeLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      // 通知父组件更新视频流
      if (onStreamUpdate) {
        onStreamUpdate(stream, 'local');
      }
      setCallStatus('已准备就绪');
    } catch (error) {
      console.error('获取媒体设备失败:', error);
      message.error('无法访问摄像头或麦克风');
    }
  };

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection(iceServers);
    
    // 添加本地流到peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // 处理远程流
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      // 通知父组件更新远程视频流
      if (onStreamUpdate) {
        onStreamUpdate(remoteStream, 'remote');
      }
    };

    // 处理ICE候选
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate);
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  };

  const startCall = async () => {
    try {
      const peerConnection = createPeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      socket.emit('offer', offer);
      setCallStatus('发起通话中...');
    } catch (error) {
      console.error('发起通话失败:', error);
      message.error('发起通话失败');
    }
  };

  const handleOffer = async (offer) => {
    try {
      const peerConnection = createPeerConnection();
      await peerConnection.setRemoteDescription(offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      socket.emit('answer', answer);
      setCallStatus('通话中');
      setIsInCall(true);
    } catch (error) {
      console.error('处理通话邀请失败:', error);
    }
  };

  const handleAnswer = async (answer) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(answer);
        setCallStatus('通话中');
        setIsInCall(true);
      }
    } catch (error) {
      console.error('处理通话应答失败:', error);
    }
  };

  const handleIceCandidate = async (candidate) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('处理ICE候选失败:', error);
    }
  };

  const handleCallStarted = () => {
    setCallStatus('通话中');
    setIsInCall(true);
  };

  const handleCallEnded = () => {
    setCallStatus('通话已结束');
    setIsInCall(false);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const handleUserJoinedCall = (data) => {
    message.success(`${data.nickname} 加入了视频通话`);
  };

  const handleUserLeftCall = (data) => {
    message.info(`${data.nickname} 离开了视频通话`);
  };

  const endCall = () => {
    socket.emit('end-call');
    handleCallEnded();
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      if (peerConnectionRef.current) {
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      }
      
      setIsScreenSharing(true);
      
      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
      };
    } catch (error) {
      console.error('屏幕共享失败:', error);
      message.error('屏幕共享失败');
    }
  };

  return (
    <div className="video-call-container">
      <div className="video-grid">
        <Card className="video-card local-video">
          <div className="video-header">
            <Text strong>我的视频</Text>
            <Text type="secondary">{isVideoEnabled ? '开启' : '关闭'}</Text>
          </div>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="video-element"
          />
        </Card>

        <Card className="video-card remote-video">
          <div className="video-header">
            <Text strong>对方视频</Text>
            <Text type="secondary">{remoteStream ? '连接中' : '等待连接'}</Text>
          </div>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="video-element"
          />
        </Card>
      </div>

      <div className="call-controls">
        <div className="call-status">
          <Title level={4}>{callStatus}</Title>
        </div>
        
        <Space size="large">
          {!isInCall ? (
            <Button 
              type="primary" 
              icon={<VideoCameraOutlined />}
              onClick={startCall}
              size="large"
            >
              开始视频通话
            </Button>
          ) : (
            <>
              <Button 
                icon={<ShareAltOutlined />}
                onClick={startScreenShare}
                disabled={isScreenSharing}
                size="large"
              >
                屏幕共享
              </Button>
            </>
          )}
          
          <Button 
            onClick={onBack}
            size="large"
          >
            返回聊天
          </Button>
        </Space>
      </div>
    </div>
  );
}

export default VideoCall;
