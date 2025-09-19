// 在浏览器控制台中运行这个脚本来调试WebRTC连接

// 1. 检查当前状态
console.log('=== WebRTC 调试信息 ===');
console.log('Socket ID:', socket?.id);
console.log('本地流状态:', localStream ? '已获取' : '未获取');
console.log('在线用户:', users);
console.log('Peer连接数量:', peerConnections?.size || 0);
console.log('远程流数量:', remoteStreams?.size || 0);

// 2. 手动触发连接（如果有其他用户）
if (users && users.length > 1) {
  const otherUser = users.find(u => u.id !== userInfo?.id);
  if (otherUser && localStream) {
    console.log('手动触发与用户', otherUser.nickname, '的连接');
    startCall(otherUser.id);
  } else {
    console.log('无法手动触发连接 - 其他用户:', !!otherUser, '本地流:', !!localStream);
  }
}

// 3. 检查远程流
if (remoteStreams) {
  remoteStreams.forEach((stream, userId) => {
    console.log('用户', userId, '的远程流:', stream.getTracks().length, '个轨道');
  });
}

// 4. 手动发送userStreamReady事件
if (localStream && userInfo?.id) {
  console.log('手动发送userStreamReady事件');
  socket.emit('userStreamReady', {
    userId: userInfo.id,
    hasStream: true
  });
}
