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
    this.lastUsersUpdate = 0;
    this.usersUpdateThrottle = 1000; // 1秒内只更新一次用户列表
  }

  // 检查昵称是否已存在
  async checkNickname(nickname) {
    try {
      console.log('🔍 检查昵称是否已存在:', nickname);
      
      const response = await fetch(`${this.baseUrl}/api/check-nickname`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nickname })
      });

      console.log('📨 昵称检查响应:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ 昵称检查结果:', result);
        return result;
      } else {
        const errorText = await response.text();
        console.error('❌ 昵称检查失败:', { 
          status: response.status, 
          statusText: response.statusText,
          error: errorText 
        });
        return { exists: false, error: '检查昵称时发生错误' };
      }
    } catch (error) {
      console.error('❌ 昵称检查网络错误:', error);
      return { exists: false, error: '网络连接错误' };
    }
  }

  // 连接聊天室
  async connect(userData) {
    console.log('🔗 尝试连接到聊天室:', { userData, baseUrl: this.baseUrl });
    
    // 如果已经在连接状态，先停止轮询
    if (this.isConnected) {
      console.log('🔄 已在连接状态，先停止当前连接');
      this.stopPolling();
      this.isConnected = false;
    }
    
    this.userId = userData.id;
    this.nickname = userData.nickname;
    
    try {
      console.log('🚀 开始发送连接请求:', userData);
      console.log('🚀 请求URL:', `${this.baseUrl}/api/join`);
      
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
        
        // 连接成功后立即获取最新数据
        setTimeout(async () => {
          await this.fetchLatestData();
        }, 100); // 100ms后获取，确保服务器端用户已添加
        
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
      if (!this.isConnected) {
        console.log('🔄 轮询跳过：未连接');
        return;
      }

      console.log('🔄 开始轮询...');
      try {
        // 并行获取消息和用户列表，提高效率
        const [messagesResponse, usersResponse] = await Promise.all([
          fetch(`${this.baseUrl}/api/messages`),
          fetch(`${this.baseUrl}/api/users?exclude=${this.userId}`)
        ]);

        // 处理消息
        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          if (this.messageCallback) {
            this.messageCallback(messages);
          }
        }

        // 处理用户列表
        if (usersResponse.ok) {
          const users = await usersResponse.json();
          console.log(`📊 轮询获取到其他用户列表: ${users.length} 人`, users.map(u => u.nickname));
          if (this.usersCallback) {
            console.log(`📊 调用用户列表回调，当前用户ID: ${this.userId}`);
            this.usersCallback(users);
          }
        } else {
          console.error('❌ 获取用户列表失败:', usersResponse.status, usersResponse.statusText);
          const errorText = await usersResponse.text();
          console.error('❌ 错误响应内容:', errorText);
        }
      } catch (error) {
        console.error('轮询错误:', error);
      }
    }, 500); // 每500ms轮询一次，实现实时更新
  }

  // 停止轮询
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  // 立即获取最新数据（用于事件驱动更新）
  async fetchLatestData() {
    if (!this.isConnected) return;

    try {
      console.log('⚡ 立即获取最新数据...');
      
      // 并行获取消息和用户列表
      const [messagesResponse, usersResponse] = await Promise.all([
        fetch(`${this.baseUrl}/api/messages`),
        fetch(`${this.baseUrl}/api/users?exclude=${this.userId}`)
      ]);

      // 处理消息
      if (messagesResponse.ok) {
        const messages = await messagesResponse.json();
        if (this.messageCallback) {
          this.messageCallback(messages);
        }
      }

      // 处理用户列表
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        console.log(`⚡ 立即获取到其他用户列表: ${users.length} 人`, users.map(u => u.nickname));
        if (this.usersCallback) {
          this.usersCallback(users);
        }
      }
    } catch (error) {
      console.error('❌ 立即获取数据失败:', error);
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
        
        // 消息发送成功后，立即获取最新状态，确保实时性
        await this.fetchLatestData();
        
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
  async disconnect(reason = 'manual_disconnect') {
    console.log('🔌 正在断开连接，原因:', reason);
    this.isConnected = false;
    this.stopPolling();

    if (this.userId) {
      const data = JSON.stringify({ userId: this.userId, reason });
      
      try {
        // 使用 fetch 发送请求，确保能等待响应
        const response = await fetch(`${this.baseUrl}/api/leave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data
        });
        
        if (response.ok) {
          console.log('✅ 离开请求发送成功，原因:', reason);
        } else {
          console.error('❌ 离开请求失败，状态码:', response.status);
        }
        
        // 清空用户信息
        this.userId = null;
        this.nickname = null;
        
        return response.ok;
      } catch (error) {
        console.error('❌ 离开请求异常:', error);
        
        // 降级到 sendBeacon
        if (navigator.sendBeacon) {
          const success = navigator.sendBeacon(`${this.baseUrl}/api/leave`, data);
          console.log('📤 降级使用 sendBeacon', success ? '成功' : '失败');
          
          // 清空用户信息
          this.userId = null;
          this.nickname = null;
          
          return success;
        }
        
        return false;
      }
    }
    
    return true;
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
