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
  const [remoteStreams, setRemoteStreams] = useState(new Map()); // 存储其他用户的流
  const [peerConnections, setPeerConnections] = useState(new Map()); // 存储WebRTC连接

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
      // 清理离开用户的流
      setRemoteStreams(prev => {
        const newStreams = new Map(prev);
        newStreams.delete(data.id);
        return newStreams;
      });
      message.info(`${data.nickname} 离开了聊天室`);
    });

    // 监听WebRTC信令
    socket.on('offer', async (data) => {
      console.log('收到offer事件:', data);
      const { offer, from } = data;
      const currentUserId = userInfo?.id || socket.id;
      
      // 使用函数式更新来获取最新的localStream状态
      setLocalStream(currentLocalStream => {
        console.log('处理offer - from:', from, 'currentUserId:', currentUserId, 'localStream存在:', !!currentLocalStream);
        
        if (from !== currentUserId && currentLocalStream) {
          console.log('开始处理offer，调用handleReceiveOffer');
          handleReceiveOffer(offer, from);
        } else {
          console.log('跳过offer处理 - from匹配:', from === currentUserId, 'localStream存在:', !!currentLocalStream);
        }
        
        return currentLocalStream;
      });
    });

    socket.on('answer', async (data) => {
      const { answer, from } = data;
      const currentUserId = userInfo?.id || socket.id;
      
      if (from !== currentUserId) {
        console.log('收到answer事件:', data);
        await handleReceiveAnswer(answer, from);
      }
    });

    socket.on('ice-candidate', async (data) => {
      const { candidate, from } = data;
      if (from !== (userInfo?.id || socket.id)) {
        await handleReceiveIceCandidate(candidate, from);
      }
    });

    // 监听其他用户流准备就绪
    socket.on('userStreamReady', (data) => {
      console.log('📨 收到用户流准备就绪通知:', data);
      const { userId } = data;
      const currentUserId = userInfo?.id || socket.id;
      
      // 使用函数式更新来获取最新的localStream状态
      setLocalStream(currentLocalStream => {
        console.log('🔍 当前localStream状态:', currentLocalStream ? '已获取' : '未获取');
        console.log('当前用户ID:', currentUserId);
        console.log('目标用户ID:', userId);
        
        if (currentLocalStream) {
          console.log('本地流轨道详情:', currentLocalStream.getTracks().map(track => ({
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState
          })));
        }
        
        // 如果我有本地流，主动向这个用户发起连接
        if (currentLocalStream && userId !== currentUserId) {
          console.log('🚀 主动向用户', userId, '发起连接');
          startCall(userId, currentLocalStream);
        } else {
          console.log('❌ 无法发起连接 - localStream:', !!currentLocalStream, 'userId匹配:', userId === currentUserId);
          // 延迟重试
          if (!currentLocalStream && userId !== currentUserId) {
            console.log('⏰ 延迟重试连接...');
            setTimeout(() => {
              setLocalStream(latestLocalStream => {
                if (latestLocalStream) {
                  console.log('🔄 延迟重试：主动向用户', userId, '发起连接');
                  startCall(userId, latestLocalStream);
                }
                return latestLocalStream;
              });
            }, 2000);
          }
        }
        
        return currentLocalStream;
      });
    });

    // 监听连接成功
    socket.on('connect', () => {
      console.log('Connected to server, Socket ID:', socket.id);
    });


    return () => {
      socket.off('message');
      socket.off('users');
      socket.off('userJoined');
      socket.off('userLeft');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('userStreamReady');
      socket.off('connect');
    };
  }, [socket, userInfo?.id]);

  // 当本地流准备就绪时，通知其他用户
  useEffect(() => {
    console.log('🔍 检查本地流状态:', {
      localStream: !!localStream,
      socketId: socket.id,
      userInfoId: userInfo?.id,
      streamTracks: localStream?.getTracks().length || 0
    });
    
    if (localStream && socket.id) {
      const currentUserId = userInfo?.id || socket.id;
      console.log('📡 本地流准备就绪，通知其他用户，用户ID:', currentUserId);
      console.log('本地流轨道详情:', localStream.getTracks().map(track => ({
        kind: track.kind,
        enabled: track.enabled,
        readyState: track.readyState
      })));
      
      socket.emit('userStreamReady', {
        userId: currentUserId,
        hasStream: true
      });
    } else {
      console.warn('⚠️ 本地流未准备好或Socket未连接:', {
        localStream: !!localStream,
        socketId: socket.id
      });
    }
  }, [localStream, userInfo?.id, socket]);

  // 调试remoteStreams状态变化
  useEffect(() => {
    console.log('remoteStreams状态更新:', Array.from(remoteStreams.keys()));
    remoteStreams.forEach((stream, userId) => {
      console.log('用户', userId, '的远程流:', stream.getTracks().length, '个轨道');
      stream.getTracks().forEach(track => {
        console.log('  轨道类型:', track.kind, '状态:', track.readyState, 'enabled:', track.enabled);
      });
    });
    
    // 检查用户列表和远程流的匹配
    console.log('当前在线用户:', users.map(u => ({ id: u.id, nickname: u.nickname })));
    console.log('当前远程流用户:', Array.from(remoteStreams.keys()));
  }, [remoteStreams, users]);

  // 当localStream更新时，更新所有现有的peer connections
  useEffect(() => {
    if (localStream) {
      // 使用函数式更新来避免依赖peerConnections
      setPeerConnections(currentPCs => {
        currentPCs.forEach((pc, userId) => {
          // 移除旧的轨道
          const senders = pc.getSenders();
          senders.forEach(sender => {
            pc.removeTrack(sender);
          });
          
          // 添加新的轨道
          localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
          });
        });
        return currentPCs; // 返回相同的Map，不修改状态
      });
    }
  }, [localStream]); // 移除peerConnections依赖，避免无限循环

  // WebRTC处理函数
  const createPeerConnection = (userId, streamToUse = localStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // 添加连接状态监听
    pc.onconnectionstatechange = () => {
      console.log('🔗 PeerConnection状态变化:', pc.connectionState, '用户:', userId);
      if (pc.connectionState === 'connected') {
        console.log('✅ 连接已建立，等待远程流...');
        // 检查是否已经有远程流
        const receivers = pc.getReceivers();
        console.log('当前接收器数量:', receivers.length);
        receivers.forEach((receiver, index) => {
          console.log(`接收器${index}:`, receiver.track?.kind, receiver.track?.readyState);
        });
        
        // 强制检查：如果接收器有轨道但ontrack没有触发，手动创建远程流
        setTimeout(() => {
          const currentReceivers = pc.getReceivers();
          const hasTracks = currentReceivers.some(receiver => receiver.track);
          console.log('🔍 延迟检查：接收器是否有轨道?', hasTracks);
          
          if (hasTracks) {
            console.log('⚠️ 检测到接收器有轨道但ontrack未触发，手动检查...');
            
            setRemoteStreams(currentStreams => {
              const hasRemoteStream = currentStreams.has(userId);
              console.log('当前是否已有远程流?', hasRemoteStream);
              
              if (!hasRemoteStream) {
                console.log('🚨 发现bug：接收器有轨道但没有远程流，手动创建远程流...');
                
                // 手动从接收器创建远程流
                const tracks = currentReceivers
                  .map(receiver => receiver.track)
                  .filter(track => track !== null && track.readyState === 'live');
                
                console.log('🔍 检查接收器轨道:', currentReceivers.map(receiver => ({
                  track: receiver.track?.kind,
                  trackState: receiver.track?.readyState,
                  trackEnabled: receiver.track?.enabled
                })));
                
                if (tracks.length > 0) {
                  console.log('🎯 手动创建远程流，轨道数量:', tracks.length);
                  tracks.forEach(track => {
                    console.log('轨道详情:', {
                      kind: track.kind,
                      readyState: track.readyState,
                      enabled: track.enabled,
                      id: track.id
                    });
                  });
                  
                  const manualRemoteStream = new MediaStream(tracks);
                  
                  console.log('✅ 手动远程流已创建，用户ID:', userId, '流:', manualRemoteStream);
                  console.log('手动流的轨道数量:', manualRemoteStream.getTracks().length);
                  
                  const newStreams = new Map(currentStreams);
                  newStreams.set(userId, manualRemoteStream);
                  console.log('当前所有远程流:', Array.from(newStreams.keys()));
                  
                  return newStreams;
                } else {
                  console.warn('⚠️ 接收器存在但没有有效的live轨道');
                  console.log('所有轨道状态:', currentReceivers.map(receiver => ({
                    track: receiver.track?.kind,
                    state: receiver.track?.readyState,
                    enabled: receiver.track?.enabled
                  })));
                }
              } else {
                console.log('✅ 远程流已存在，无需手动创建');
              }
              
              return currentStreams;
            });
          }
        }, 1000);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE连接状态变化:', pc.iceConnectionState, '用户:', userId);
      if (pc.iceConnectionState === 'connected') {
        console.log('✅ ICE连接已建立，应该开始接收远程流...');
      }
    };

    // 添加本地流
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => {
        pc.addTrack(track, streamToUse);
      });
      console.log('添加本地流到PeerConnection，用户:', userId, '轨道数量:', streamToUse.getTracks().length);
    }

    // 处理远程流 - 使用更可靠的方式
    pc.ontrack = (event) => {
      console.log('🎥 收到远程流事件! 用户:', userId, '流数量:', event.streams.length);
      console.log('ontrack事件详情:', {
        streams: event.streams.length,
        track: event.track?.kind,
        trackState: event.track?.readyState,
        trackEnabled: event.track?.enabled
      });
      
      if (event.streams && event.streams.length > 0) {
        const remoteStream = event.streams[0];
        console.log('收到远程流:', remoteStream);
        console.log('远程流轨道数量:', remoteStream.getTracks().length);
        remoteStream.getTracks().forEach(track => {
          console.log('轨道类型:', track.kind, '状态:', track.readyState, 'enabled:', track.enabled);
        });
        
        // 直接使用闭包中的userId，因为这是创建时设置的
        console.log('设置远程流到状态，用户ID:', userId, '流:', remoteStream);
        setRemoteStreams(prev => {
          const newStreams = new Map(prev);
          newStreams.set(userId, remoteStream);
          console.log('✅ 远程流已设置，用户ID:', userId);
          console.log('当前所有远程流:', Array.from(newStreams.keys()));
          return newStreams;
        });
      } else {
        console.warn('⚠️ ontrack事件触发但streams为空');
      }
    };
    
    // 添加额外的调试：检查是否已经有远程流
    console.log('🔧 PeerConnection创建完成，用户:', userId);
    console.log('🔧 ontrack事件已设置');

    // 处理ICE候选
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('发送ICE候选给用户:', userId, '候选:', event.candidate);
        const currentUserId = userInfo?.id || socket.id;
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: userId,
          from: currentUserId
        });
      } else {
        console.log('ICE候选收集完成，用户:', userId);
      }
    };

    return pc;
  };

  const handleReceiveOffer = async (offer, from) => {
    console.log('收到来自用户', from, '的offer');
    
    // 检查是否已经存在PeerConnection
    setPeerConnections(prev => {
      const existingPC = prev.get(from);
      if (existingPC) {
        console.log('用户', from, '已存在PeerConnection，关闭旧连接');
        existingPC.close();
      }
      
      const pc = createPeerConnection(from);
      const newPCs = new Map(prev);
      newPCs.set(from, pc);
      console.log('PeerConnection已存储(接收offer)，用户ID:', from, '总数:', newPCs.size);
      console.log('存储后的PeerConnections用户列表:', Array.from(newPCs.keys()));
      
      // 异步处理offer，避免阻塞状态更新
      (async () => {
        try {
          await pc.setRemoteDescription(offer);
          console.log('成功设置远程描述(offer)，用户:', from, '状态:', pc.signalingState);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log('成功设置本地描述(answer)，用户:', from, '状态:', pc.signalingState);
          
          console.log('发送answer给用户', from);
          const currentUserId = userInfo?.id || socket.id;
          socket.emit('answer', {
            answer: answer,
            to: from,
            from: currentUserId
          });
        } catch (error) {
          console.error('处理offer失败，用户:', from, '错误:', error);
        }
      })();
      
      return newPCs;
    });
  };

  const handleReceiveAnswer = async (answer, from) => {
    console.log('收到answer，来自用户:', from);
    
    // 使用函数式更新来获取最新的peerConnections状态
    setPeerConnections(currentPCs => {
      const pc = currentPCs.get(from);
      if (pc) {
        console.log('PeerConnection当前信令状态:', pc.signalingState, '用户:', from);
        
        if (pc.signalingState === 'have-local-offer') {
          pc.setRemoteDescription(answer).then(() => {
            console.log('✅ 成功设置远程描述(answer)，用户:', from, '状态:', pc.signalingState);
            // 检查连接状态和接收器
            console.log('连接状态:', pc.connectionState);
            console.log('ICE连接状态:', pc.iceConnectionState);
            const receivers = pc.getReceivers();
            console.log('接收器数量:', receivers.length);
            receivers.forEach((receiver, index) => {
              console.log(`接收器${index}:`, receiver.track?.kind, receiver.track?.readyState);
            });
          }).catch(error => {
            console.error('设置远程描述失败，用户:', from, '错误:', error);
          });
        } else {
          console.error('PeerConnection状态不正确，无法设置answer，用户:', from, '当前状态:', pc.signalingState);
        }
      } else {
        console.error('找不到PeerConnection(接收answer)，用户:', from);
        console.log('当前PeerConnections中的用户:', Array.from(currentPCs.keys()));
      }
      return currentPCs; // 返回相同的Map，不修改状态
    });
  };

  const handleReceiveIceCandidate = async (candidate, from) => {
    console.log('收到ICE候选，来自用户:', from);
    
    // 使用函数式更新来获取最新的peerConnections状态
    setPeerConnections(currentPCs => {
      const pc = currentPCs.get(from);
      if (pc) {
        try {
          pc.addIceCandidate(candidate).then(() => {
            console.log('成功添加ICE候选，用户:', from);
          }).catch(error => {
            console.error('添加ICE候选失败，用户:', from, '错误:', error);
          });
        } catch (error) {
          console.error('添加ICE候选失败，用户:', from, '错误:', error);
        }
      } else {
        console.error('找不到PeerConnection，用户:', from);
        console.log('当前PeerConnections中的用户:', Array.from(currentPCs.keys()));
      }
      return currentPCs; // 返回相同的Map，不修改状态
    });
  };

  const startCall = async (userId, streamToUse = localStream) => {
    if (!streamToUse) {
      console.log('无法开始通话：没有本地流');
      return;
    }
    
    console.log('开始与用户', userId, '建立连接');
    
    // 检查是否已经存在PeerConnection
    setPeerConnections(prev => {
      const existingPC = prev.get(userId);
      if (existingPC) {
        console.log('用户', userId, '已存在PeerConnection，关闭旧连接');
        existingPC.close();
      }
      
      const pc = createPeerConnection(userId, streamToUse);
      const newPCs = new Map(prev);
      newPCs.set(userId, pc);
      console.log('PeerConnection已存储，用户ID:', userId, '总数:', newPCs.size);
      console.log('存储后的PeerConnections用户列表:', Array.from(newPCs.keys()));
      
      // 异步处理offer，避免阻塞状态更新
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log('成功设置本地描述(offer)，用户:', userId, '状态:', pc.signalingState);
          
          console.log('发送offer给用户', userId);
          const currentUserId = userInfo?.id || socket.id;
          socket.emit('offer', {
            offer: offer,
            to: userId,
            from: currentUserId
          });
        } catch (error) {
          console.error('创建offer失败，用户:', userId, '错误:', error);
        }
      })();
      
      return newPCs;
    });
  };

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
      
      // 通知其他用户我有了新的流，让他们主动连接我
      const currentUserId = userInfo?.id || socket.id;
      console.log('发送userStreamReady事件，用户ID:', currentUserId);
      socket.emit('userStreamReady', {
        userId: currentUserId,
        hasStream: true
      });
      
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
                    remoteStream={(() => {
                      const stream = remoteStreams.get(user.id) || null;
                      console.log('传递给OtherUserCard的remoteStream - 用户:', user.nickname, '流:', stream);
                      return stream;
                    })()}
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
