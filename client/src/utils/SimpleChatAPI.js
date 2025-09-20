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
        
        // 连接成功后立即获取一次用户列表
        setTimeout(async () => {
          try {
            const usersResponse = await fetch(`${this.baseUrl}/api/users?exclude=${this.userId}`);
            if (usersResponse.ok) {
              const users = await usersResponse.json();
              console.log(`📊 连接后立即获取其他用户列表: ${users.length} 人`, users.map(u => u.nickname));
              if (this.usersCallback) {
                this.usersCallback(users);
              }
            }
          } catch (error) {
            console.error('立即获取用户列表失败:', error);
          }
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
      if (!this.isConnected) return;

      try {
        // 发送心跳
        if (this.userId && this.isConnected) {
          try {
            const heartbeatResponse = await fetch(`${this.baseUrl}/api/heartbeat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userId: this.userId })
            });
            
            if (!heartbeatResponse.ok) {
              console.error('💓 心跳发送失败:', heartbeatResponse.status);
            } else {
              console.log('💓 心跳发送成功');
            }
          } catch (error) {
            console.error('💓 心跳发送网络错误:', error);
          }
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

        // 获取用户列表（每次轮询都获取，确保实时性）
        try {
          const usersResponse = await fetch(`${this.baseUrl}/api/users?exclude=${this.userId}`);
          if (usersResponse.ok) {
            const users = await usersResponse.json();
            console.log(`📊 轮询获取到其他用户列表: ${users.length} 人`, users.map(u => u.nickname));
            if (this.usersCallback) {
              this.usersCallback(users);
            }
          } else {
            console.error('❌ 获取用户列表失败:', usersResponse.status, usersResponse.statusText);
          }
        } catch (error) {
          console.error('❌ 获取用户列表网络错误:', error);
          // 网络错误时不更新用户列表，避免显示空列表
        }
      } catch (error) {
        console.error('轮询错误:', error);
      }
    }, 3000); // 每3秒轮询一次，减少闪烁问题
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
        
        // 消息发送成功后，立即获取一次消息列表，确保实时性
        try {
          const messagesResponse = await fetch(`${this.baseUrl}/api/messages`);
          if (messagesResponse.ok) {
            const messages = await messagesResponse.json();
            console.log(`📨 消息发送后立即获取消息列表: ${messages.length} 条消息`);
            if (this.messageCallback) {
              this.messageCallback(messages);
            }
          }
        } catch (error) {
          console.error('❌ 消息发送后获取消息列表失败:', error);
        }
        
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
  disconnect(reason = 'manual_disconnect') {
    console.log('🔌 正在断开连接，原因:', reason);
    this.isConnected = false;
    this.stopPolling();

    if (this.userId) {
      // 优先使用 sendBeacon，确保在页面卸载时也能发送
      if (navigator.sendBeacon) {
        const data = JSON.stringify({ userId: this.userId, reason });
        const success = navigator.sendBeacon(`${this.baseUrl}/api/leave`, data);
        console.log('📤 使用 sendBeacon 发送离开请求', success ? '成功' : '失败', '原因:', reason);
        
        // 如果 sendBeacon 失败，尝试同步请求
        if (!success) {
          try {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${this.baseUrl}/api/leave`, false); // 同步请求
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
            console.log('📤 同步请求离开聊天室完成，原因:', reason);
          } catch (error) {
            console.error('📤 同步请求失败:', error);
          }
        }
      } else {
        // 降级到普通 fetch
        fetch(`${this.baseUrl}/api/leave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: this.userId, reason })
        }).catch(error => {
          console.error('离开请求失败:', error);
        });
      }
      
      // 清空用户信息
      this.userId = null;
      this.nickname = null;
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
