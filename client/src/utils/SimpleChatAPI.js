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
    console.log('🔗 尝试连接到聊天室:', { userData, baseUrl: this.baseUrl });
    
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

      console.log('📨 连接响应:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ 连接成功:', result);
        this.isConnected = true;
        this.startPolling();
        console.log('✅ 成功连接到聊天室，开始轮询');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ 连接失败:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        return false;
      }
    } catch (error) {
      console.error('❌ 连接网络错误:', error);
      return false;
    }
  }

  // 开始轮询
  startPolling() {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(async () => {
      if (!this.isConnected) return;

      try {
        // 发送心跳
        if (this.userId && this.isConnected) {
          fetch(`${this.baseUrl}/api/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId: this.userId })
          }).catch(error => {
            console.error('心跳发送失败:', error);
          });
        } else if (this.userId && !this.isConnected) {
          console.error('❌ 未连接，无法发送心跳');
        }

        // 获取新消息
        const messagesResponse = await fetch(`${this.baseUrl}/api/messages`);
        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          if (this.messageCallback) {
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
    }, 500); // 每500ms轮询一次，提高响应速度
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
    console.log('🚀 尝试发送消息:', { 
      isConnected: this.isConnected, 
      userId: this.userId, 
      nickname: this.nickname, 
      message: messageText,
      baseUrl: this.baseUrl 
    });

    if (!this.isConnected) {
      console.error('❌ 未连接到聊天室');
      return false;
    }

    if (!this.userId || !this.nickname) {
      console.error('❌ 用户信息不完整:', { userId: this.userId, nickname: this.nickname });
      return false;
    }

    try {
      const requestBody = {
        userId: this.userId,
        nickname: this.nickname,
        message: messageText
      };
      
      console.log('📤 发送请求体:', requestBody);
      
      const response = await fetch(`${this.baseUrl}/api/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📨 收到响应:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ 消息发送成功:', result);
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ 消息发送失败:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        return false;
      }
    } catch (error) {
      console.error('❌ 发送消息网络错误:', error);
      return false;
    }
  }

  // 断开连接
  disconnect() {
    console.log('🔌 正在断开连接');
    this.isConnected = false;
    this.stopPolling();

    if (this.userId) {
      // 优先使用 sendBeacon，确保在页面卸载时也能发送
      if (navigator.sendBeacon) {
        const data = JSON.stringify({ userId: this.userId });
        navigator.sendBeacon(`${this.baseUrl}/api/leave`, data);
        console.log('📤 使用 sendBeacon 发送离开请求');
      } else {
        // 降级到普通 fetch
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
