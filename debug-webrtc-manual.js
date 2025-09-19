// 在浏览器控制台运行这个脚本来手动调试WebRTC连接

console.log('=== WebRTC 手动调试 ===');

// 检查当前状态
console.log('当前状态:');
console.log('Socket ID:', window.debugWebRTC?.socket?.id);
console.log('本地流状态:', !!window.debugWebRTC?.localStream);
console.log('在线用户:', window.debugWebRTC?.users);
console.log('当前用户信息:', window.debugWebRTC?.userInfo);
console.log('PeerConnections数量:', window.debugWebRTC?.peerConnections?.size);
console.log('远程流数量:', window.debugWebRTC?.remoteStreams?.size);

// 手动触发连接
if (window.debugWebRTC?.users && window.debugWebRTC.users.length > 1) {
  const otherUser = window.debugWebRTC.users.find(u => u.id !== window.debugWebRTC.userInfo?.id);
  if (otherUser && window.debugWebRTC.localStream) {
    console.log('手动触发与用户', otherUser.nickname, '的连接...');
    window.debugWebRTC.startCall(otherUser.id, window.debugWebRTC.localStream);
  } else {
    console.log('无法手动触发连接 - 其他用户:', !!otherUser, '本地流:', !!window.debugWebRTC.localStream);
  }
}

// 手动发送userStreamReady事件
if (window.debugWebRTC?.localStream && window.debugWebRTC?.socket) {
  console.log('手动发送userStreamReady事件...');
  const currentUserId = window.debugWebRTC.userInfo?.id || window.debugWebRTC.socket.id;
  window.debugWebRTC.socket.emit('userStreamReady', {
    userId: currentUserId,
    hasStream: true
  });
}

console.log('调试完成！请查看控制台日志。');
