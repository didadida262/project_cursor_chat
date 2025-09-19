// 简单的聊天API，使用轮询而不是WebSocket
class SimpleChatAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.pollingInterval = null;
    this.messageCallback = null;
    this.usersCallback = null;
    this.isConnected = false;
    this.userId = null;
    this.nickname = null;
  }

  // 连接聊天室
  async connect(userData) {
    this.userId = userData.id;
    this.nickname = userData.nickname;
    
    try {
      // 发送用户加入请求
      const response = await fetch(`${this.baseUrl}/api/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      if (response.ok) {
        this.isConnected = true;
        this.startPolling();
        console.log('✅ 成功连接到聊天室');
        return true;
      } else {
        console.error('❌ 连接失败:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ 连接错误:', error);
      return false;
    }
  }

  // 开始轮询
  startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      if (!this.isConnected) return;

      try {
        // 获取新消息
        const messagesResponse = await fetch(`${this.baseUrl}/api/messages`);
        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          if (this.messageCallback && messages.length > 0) {
            this.messageCallback(messages);
          }
        }

        // 获取用户列表
        const usersResponse = await fetch(`${this.baseUrl}/api/users`);
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          if (this.usersCallback) {
            this.usersCallback(users);
          }
        }
      } catch (error) {
        console.error('轮询错误:', error);
      }
    }, 2000); // 每2秒轮询一次
  }

  // 停止轮询
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // 发送消息
  async sendMessage(messageText) {
    if (!this.isConnected) return false;

    try {
      const response = await fetch(`${this.baseUrl}/api/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: this.userId,
          nickname: this.nickname,
          message: messageText
        })
      });

      return response.ok;
    } catch (error) {
      console.error('发送消息错误:', error);
      return false;
    }
  }

  // 断开连接
  disconnect() {
    this.isConnected = false;
    this.stopPolling();
    
    if (this.userId) {
      // 发送离开请求
      fetch(`${this.baseUrl}/api/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: this.userId })
      }).catch(error => {
        console.error('离开请求失败:', error);
      });
    }
  }

  // 设置回调函数
  onMessage(callback) {
    this.messageCallback = callback;
  }

  onUsers(callback) {
    this.usersCallback = callback;
  }
}

export default SimpleChatAPI;
