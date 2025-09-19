/**
 * 媒体协调器 - 处理多标签页间的媒体设备协调
 * 参考 mediasoup 的实现方式
 */
class MediaCoordinator {
  constructor() {
    // 检查BroadcastChannel支持
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('media-coordination');
    } else {
      console.warn('BroadcastChannel not supported, using localStorage fallback');
      this.broadcastChannel = null;
    }
    
    this.tabId = this.generateTabId();
    this.isMediaOwner = false;
    this.mediaLock = false;
    this.listeners = new Map();
    
    this.setupCoordination();
  }

  /**
   * 生成唯一的标签页ID
   */
  generateTabId() {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置标签页间协调
   */
  setupCoordination() {
    if (!this.broadcastChannel) {
      console.log('BroadcastChannel not available, skipping coordination setup');
      return;
    }
    
    this.broadcastChannel.onmessage = (event) => {
      const { type, tabId, data } = event.data;
      
      // 忽略自己发送的消息
      if (tabId === this.tabId) return;

      switch (type) {
        case 'media-request':
          this.handleMediaRequest(data);
          break;
        case 'media-release':
          this.handleMediaRelease(data);
          break;
        case 'media-lock':
          this.handleMediaLock(data);
          break;
        case 'media-unlock':
          this.handleMediaUnlock(data);
          break;
        case 'heartbeat':
          this.handleHeartbeat(data);
          break;
      }
    };

    // 定期发送心跳
    this.heartbeatInterval = setInterval(() => {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({
          type: 'heartbeat',
          tabId: this.tabId,
          data: { timestamp: Date.now() }
        });
      }
    }, 1000);

    // 页面卸载时释放媒体
    window.addEventListener('beforeunload', () => {
      this.releaseMedia();
    });

    // 页面隐藏时暂停媒体
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseMedia();
      } else {
        this.resumeMedia();
      }
    });
  }

  /**
   * 请求媒体访问权限（支持多标签页）
   */
  async requestMediaAccess(constraints = { video: true, audio: true }) {
    try {
      // 获取设备列表
      const devices = await this.getAvailableDevices();
      
      // 为每个标签页分配不同的设备（如果有多个设备）
      const deviceConstraints = this.buildDeviceConstraints(devices, constraints);
      
      // 尝试获取媒体流
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(deviceConstraints);
      } catch (error) {
        console.warn('使用指定设备失败，尝试默认设备:', error);
        // 降级到默认约束
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      
      // 克隆流以避免多标签页冲突
      const clonedStream = this.cloneMediaStream(stream);
      
      // 停止原始流
      stream.getTracks().forEach(track => track.stop());
      
      this.isMediaOwner = true;
      console.log(`标签页 ${this.tabId} 成功获取媒体设备，流ID: ${clonedStream.id}`);
      
      return clonedStream;
    } catch (error) {
      console.error('获取媒体设备失败:', error);
      throw error;
    }
  }

  /**
   * 获取可用的媒体设备
   */
  async getAvailableDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        video: devices.filter(d => d.kind === 'videoinput'),
        audio: devices.filter(d => d.kind === 'audioinput')
      };
    } catch (error) {
      console.error('获取设备列表失败:', error);
      return { video: [], audio: [] };
    }
  }

  /**
   * 构建设备约束条件（为不同标签页分配不同设备）
   */
  buildDeviceConstraints(devices, constraints) {
    const deviceConstraints = {
      video: constraints.video ? true : false,
      audio: constraints.audio ? true : false
    };

    // 如果有多个视频设备，尝试为不同标签页分配不同设备
    if (constraints.video && devices.video.length > 1) {
      const deviceIndex = this.getDeviceIndex(devices.video.length);
      deviceConstraints.video = {
        deviceId: { exact: devices.video[deviceIndex].deviceId },
        width: { ideal: 640 },
        height: { ideal: 480 }
      };
    }

    // 如果有多个音频设备，尝试为不同标签页分配不同设备
    if (constraints.audio && devices.audio.length > 1) {
      const deviceIndex = this.getDeviceIndex(devices.audio.length);
      deviceConstraints.audio = {
        deviceId: { exact: devices.audio[deviceIndex].deviceId },
        echoCancellation: true,
        noiseSuppression: true
      };
    }

    return deviceConstraints;
  }

  /**
   * 根据标签页ID获取设备索引
   */
  getDeviceIndex(deviceCount) {
    // 使用标签页ID的哈希值来选择设备
    let hash = 0;
    for (let i = 0; i < this.tabId.length; i++) {
      const char = this.tabId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash) % deviceCount;
  }

  /**
   * 克隆媒体流
   */
  cloneMediaStream(originalStream) {
    const clonedStream = new MediaStream();
    
    originalStream.getTracks().forEach(track => {
      const clonedTrack = track.clone();
      clonedStream.addTrack(clonedTrack);
    });
    
    console.log(`媒体流已克隆: ${originalStream.id} -> ${clonedStream.id}`);
    return clonedStream;
  }

  /**
   * 锁定媒体设备
   */
  lockMedia() {
    this.mediaLock = true;
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'media-lock',
        tabId: this.tabId,
        data: { timestamp: Date.now() }
      });
    }
  }

  /**
   * 释放媒体设备
   */
  releaseMedia() {
    this.isMediaOwner = false;
    this.mediaLock = false;
    
    if (this.broadcastChannel) {
      try {
        // 检查channel是否还开着
        if (this.broadcastChannel.readyState === 'open') {
          this.broadcastChannel.postMessage({
            type: 'media-release',
            tabId: this.tabId,
            data: { timestamp: Date.now() }
          });
        }
      } catch (error) {
        console.warn('BroadcastChannel postMessage failed:', error);
      }
      
      try {
        this.broadcastChannel.close();
      } catch (error) {
        console.warn('BroadcastChannel close failed:', error);
      }
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * 暂停媒体（页面隐藏时）
   */
  pauseMedia() {
    if (this.isMediaOwner && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'media-pause',
        tabId: this.tabId,
        data: { timestamp: Date.now() }
      });
    }
  }

  /**
   * 恢复媒体（页面显示时）
   */
  resumeMedia() {
    if (this.isMediaOwner && this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'media-resume',
        tabId: this.tabId,
        data: { timestamp: Date.now() }
      });
    }
  }

  /**
   * 等待媒体释放
   */
  waitForMediaRelease() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(null);
      }, 10000); // 10秒超时

      const handler = (event) => {
        const { type } = event.data;
        if (type === 'media-release') {
          clearTimeout(timeout);
          if (this.broadcastChannel) {
            this.broadcastChannel.removeEventListener('message', handler);
          }
          resolve(true);
        }
      };

      if (this.broadcastChannel) {
        this.broadcastChannel.addEventListener('message', handler);
      }
    });
  }

  /**
   * 处理媒体请求
   */
  handleMediaRequest(data) {
    console.log('收到媒体请求:', data);
    // 可以在这里实现更复杂的协调逻辑
  }

  /**
   * 处理媒体释放
   */
  handleMediaRelease(data) {
    console.log('媒体设备已释放:', data);
    this.mediaLock = false;
  }

  /**
   * 处理媒体锁定
   */
  handleMediaLock(data) {
    console.log('媒体设备被锁定:', data);
    this.mediaLock = true;
  }

  /**
   * 处理媒体解锁
   */
  handleMediaUnlock(data) {
    console.log('媒体设备解锁:', data);
    this.mediaLock = false;
  }

  /**
   * 处理心跳
   */
  handleHeartbeat(data) {
    // 可以在这里实现标签页存活检测
  }

  /**
   * 克隆媒体流
   */
  cloneMediaStream(originalStream) {
    if (!originalStream) return null;
    
    const clonedStream = new MediaStream();
    originalStream.getTracks().forEach(track => {
      // 克隆轨道而不是直接添加
      const clonedTrack = track.clone();
      clonedStream.addTrack(clonedTrack);
    });
    
    return clonedStream;
  }

  /**
   * 停止媒体流
   */
  stopMediaStream(stream) {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }
  }
}

// 创建单例实例
const mediaCoordinator = new MediaCoordinator();

export default mediaCoordinator;
