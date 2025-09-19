import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const app = express();
const server = createServer(app);

// MongoDB 连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatroom';

// 尝试连接 MongoDB，但不阻塞服务器启动
if (MONGODB_URI && MONGODB_URI !== 'mongodb://localhost:27017/chatroom') {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      console.log('⚠️ Server will continue without MongoDB (using memory storage)');
    });
} else {
  console.log('⚠️ No MongoDB URI provided, using memory storage');
}

// 消息模型
const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  nickname: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? "*" : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? "*" : "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// 存储在线用户
const onlineUsers = new Map();

// 用户心跳检测 - 记录用户最后活跃时间
const userHeartbeats = new Map();

// 内存存储作为备用方案
const memoryMessages = [];

// 心跳检测配置
const HEARTBEAT_TIMEOUT = 10000; // 10秒无响应视为离线
const HEARTBEAT_CHECK_INTERVAL = 5000; // 每5秒检查一次

// 心跳检测定时器
setInterval(() => {
  const now = Date.now();
  const inactiveUsers = [];
  
  // 检查所有用户的心跳
  for (const [userId, lastHeartbeat] of userHeartbeats.entries()) {
    if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      inactiveUsers.push(userId);
    }
  }
  
  // 清理离线用户
  if (inactiveUsers.length > 0) {
    console.log(`💔 检测到 ${inactiveUsers.length} 个离线用户，正在清理...`);
    
    inactiveUsers.forEach(userId => {
      const user = onlineUsers.get(userId);
      if (user) {
        onlineUsers.delete(userId);
        userHeartbeats.delete(userId);
        console.log(`🧹 清理离线用户: ${user.nickname} (ID: ${userId})`);
      }
    });
    
    // 广播更新后的用户列表
    io.emit('users', Array.from(onlineUsers.values()));
    console.log(`📤 已广播清理后的用户列表，当前在线: ${onlineUsers.size} 人`);
  }
}, HEARTBEAT_CHECK_INTERVAL);

// 消息存储相关的辅助函数
const HISTORY_LIMIT = 50;
const MAX_MESSAGES = 1000;

// 从存储获取消息历史
async function getMessages() {
  try {
    // 尝试从 MongoDB 获取
    if (mongoose.connection.readyState === 1) {
      const messages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(HISTORY_LIMIT)
        .lean();
      return messages.reverse();
    } else {
      // 使用内存存储
      console.log('Using memory storage for messages');
      return memoryMessages.slice(-HISTORY_LIMIT);
    }
  } catch (error) {
    console.error('Error getting messages:', error);
    // 降级到内存存储
    return memoryMessages.slice(-HISTORY_LIMIT);
  }
}

// 存储新消息
async function saveMessage(messageData) {
  try {
    // 先保存到内存存储
    memoryMessages.push(messageData);
    if (memoryMessages.length > MAX_MESSAGES) {
      memoryMessages.splice(0, memoryMessages.length - MAX_MESSAGES);
    }
    
    // 尝试保存到 MongoDB
    if (mongoose.connection.readyState === 1) {
      const message = new Message({
        id: messageData.id,
        userId: messageData.userId,
        nickname: messageData.nickname,
        message: messageData.message,
        timestamp: new Date(messageData.timestamp)
      });
      
      await message.save();
      
      // 清理旧消息，保持数据库大小合理
      const messageCount = await Message.countDocuments();
      if (messageCount > MAX_MESSAGES) {
        const oldestMessages = await Message.find()
          .sort({ timestamp: 1 })
          .limit(messageCount - MAX_MESSAGES)
          .select('_id');
        
        const idsToDelete = oldestMessages.map(msg => msg._id);
        await Message.deleteMany({ _id: { $in: idsToDelete } });
      }
      
      console.log(`Message saved to MongoDB: ${messageData.nickname}: ${messageData.message}`);
    } else {
      console.log(`Message saved to memory: ${messageData.nickname}: ${messageData.message}`);
    }
  } catch (error) {
    console.error('Error saving message:', error);
    console.log(`Message saved to memory (fallback): ${messageData.nickname}: ${messageData.message}`);
  }
}

// 路由
app.get('/', async (req, res) => {
  try {
    let messageCount = 0;
    let storageType = 'Memory';
    
    if (mongoose.connection.readyState === 1) {
      messageCount = await Message.countDocuments();
      storageType = 'MongoDB Atlas';
    } else {
      messageCount = memoryMessages.length;
      storageType = 'Memory (MongoDB unavailable)';
    }
    
    res.json({ 
      message: 'Chatroom Server is running',
      onlineUsers: onlineUsers.size,
      totalMessages: messageCount,
      storage: storageType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ 
      message: 'Chatroom Server is running',
      onlineUsers: onlineUsers.size,
      totalMessages: memoryMessages.length,
      storage: 'Memory (Error)',
      timestamp: new Date().toISOString()
    });
  }
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    onlineUsers: onlineUsers.size
  });
});

// 清理所有用户（用于测试）
app.post('/api/clear-users', (req, res) => {
  const userCount = onlineUsers.size;
  onlineUsers.clear();
  console.log(`🧹 清理了 ${userCount} 个用户`);
  
  res.json({ 
    success: true, 
    message: `已清理 ${userCount} 个用户`,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/users', (req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await getMessages();
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.json([]);
  }
});

// 用户加入API
app.post('/api/join', (req, res) => {
  const userData = req.body;
  
  // 检查是否已存在相同昵称的用户
  const existingUser = Array.from(onlineUsers.values()).find(u => u.nickname === userData.nickname);
  if (existingUser) {
    // 如果存在相同昵称，更新现有用户的ID和加入时间
    onlineUsers.delete(existingUser.id);
    console.log(`🔄 更新现有用户昵称: ${userData.nickname}`);
  }
  
  const user = {
    id: userData.id,
    nickname: userData.nickname,
    isOnline: true,
    joinTime: new Date().toISOString()
  };
  
  onlineUsers.set(userData.id, user);
  userHeartbeats.set(userData.id, Date.now()); // 记录心跳时间
  console.log(`✅ 用户通过API加入: ${user.nickname} (ID: ${user.id})`);
  console.log(`👥 当前在线用户: ${onlineUsers.size} 人`);
  
  res.json({ success: true, user });
});

// 用户离开API
app.post('/api/leave', (req, res) => {
  const { userId } = req.body;
  const user = onlineUsers.get(userId);
  
  if (user) {
    onlineUsers.delete(userId);
    userHeartbeats.delete(userId); // 清理心跳记录
    console.log(`👋 用户通过API离开: ${user.nickname}`);
  }
  
  res.json({ success: true });
});

// 心跳API
app.post('/api/heartbeat', (req, res) => {
  const { userId } = req.body;
  
  if (userId && onlineUsers.has(userId)) {
    userHeartbeats.set(userId, Date.now());
    console.log(`💓 收到用户心跳: ${userId}`);
  }
  
  res.json({ success: true });
});

// 发送消息API
app.post('/api/message', async (req, res) => {
  const messageData = req.body;
  const message = {
    id: uuidv4(),
    userId: messageData.userId,
    nickname: messageData.nickname,
    message: messageData.message,
    timestamp: new Date().toISOString()
  };
  
  // 保存消息
  await saveMessage(message);
  
  console.log(`📨 通过API收到消息: ${message.nickname}: ${message.message}`);
  
  // 更新发送者的心跳时间
  if (userHeartbeats.has(messageData.userId)) {
    userHeartbeats.set(messageData.userId, Date.now());
  }
  
  res.json({ success: true, message });
});

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // 设置customId为socket.id，用于WebRTC信令
  socket.customId = socket.id;

  // 用户加入聊天室
  socket.on('join', async (userData) => {
    console.log('📥 收到join事件:', userData);
    
    const user = {
      id: socket.id,
      nickname: userData.nickname,
      isOnline: true,
      joinTime: new Date().toISOString()
    };
    
    onlineUsers.set(socket.id, user);
    userHeartbeats.set(socket.id, Date.now()); // 记录心跳时间
    console.log('👥 在线用户列表更新:', Array.from(onlineUsers.values()));
    
    // 通知其他用户有新用户加入
    socket.broadcast.emit('userJoined', user);
    console.log('📢 已通知其他用户有新用户加入');
    
    // 发送当前在线用户列表
    io.emit('users', Array.from(onlineUsers.values()));
    console.log('📤 已发送用户列表给所有用户');
    
    // 发送历史消息
    try {
      const messageHistory = await getMessages();
      socket.emit('messages', messageHistory);
      console.log(`📜 已发送 ${messageHistory.length} 条历史消息给 ${user.nickname}`);
    } catch (error) {
      console.error('❌ 发送历史消息失败:', error);
      socket.emit('messages', []);
    }
    
    console.log(`✅ 用户 ${user.nickname} 成功加入聊天室`);
  });

  // 处理消息
  socket.on('message', async (messageData) => {
    const message = {
      id: uuidv4(),
      userId: messageData.userId,
      nickname: messageData.nickname,
      message: messageData.message,
      timestamp: new Date().toISOString()
    };
    
    // 先广播消息给所有用户
    io.emit('message', message);
    
    // 然后尝试保存到数据库（不阻塞消息发送）
    try {
      await saveMessage(message);
    } catch (error) {
      console.error('保存消息失败，但消息已发送:', error);
    }
    
    console.log(`Message from ${message.nickname}: ${message.message}`);
  });

  // WebRTC 信令处理
  socket.on('offer', (data) => {
    const { offer, to } = data;
    console.log(`Offer转发: ${socket.customId} -> ${to}`);
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.customId === to);
    if (targetSocket) {
      targetSocket.emit('offer', { offer, from: socket.customId });
      console.log(`Offer转发成功: ${socket.customId} -> ${to}`);
    } else {
      console.log(`Offer转发失败: 找不到目标用户 ${to}`);
      console.log('当前在线用户:', Array.from(io.sockets.sockets.values()).map(s => s.customId));
    }
  });

  socket.on('answer', (data) => {
    const { answer, to } = data;
    console.log(`Answer转发: ${socket.customId} -> ${to}`);
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.customId === to);
    if (targetSocket) {
      targetSocket.emit('answer', { answer, from: socket.customId });
      console.log(`Answer转发成功: ${socket.customId} -> ${to}`);
    } else {
      console.log(`Answer转发失败: 找不到目标用户 ${to}`);
    }
  });

  socket.on('ice-candidate', (data) => {
    const { candidate, to } = data;
    console.log(`ICE候选转发: ${socket.customId} -> ${to}`);
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.customId === to);
    if (targetSocket) {
      targetSocket.emit('ice-candidate', { candidate, from: socket.customId });
      console.log(`ICE候选转发成功: ${socket.customId} -> ${to}`);
    } else {
      console.log(`ICE候选转发失败: 找不到目标用户 ${to}`);
    }
  });

  // 处理用户流准备就绪事件
  socket.on('userStreamReady', (data) => {
    console.log(`User ${data.userId} stream ready`);
    // 广播给其他用户
    socket.broadcast.emit('userStreamReady', data);
  });

  // 视频通话控制
  socket.on('start-call', () => {
    socket.broadcast.emit('call-started');
  });

  socket.on('end-call', () => {
    socket.broadcast.emit('call-ended');
  });

  // 用户离开聊天室
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      // 通知其他用户
      socket.broadcast.emit('userLeft', user);
      
      // 从在线用户列表中移除
      onlineUsers.delete(socket.id);
      userHeartbeats.delete(socket.id); // 清理心跳记录
      
      // 更新用户列表
      io.emit('users', Array.from(onlineUsers.values()));
      
      console.log(`User ${user.nickname} left the chatroom`);
    }
    
    console.log('User disconnected:', socket.id);
  });

  // 错误处理
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// 服务器启动
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
