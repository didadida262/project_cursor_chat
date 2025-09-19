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
    origin: process.env.NODE_ENV === 'production' ? true : "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 中间件
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : "http://localhost:3000",
  credentials: true
}));
app.use(express.json());

// 存储在线用户
const onlineUsers = new Map();

// 内存存储作为备用方案
const memoryMessages = [];

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
      storage: storageType
    });
  } catch (error) {
    res.json({ 
      message: 'Chatroom Server is running',
      onlineUsers: onlineUsers.size,
      totalMessages: memoryMessages.length,
      storage: 'Memory (Error)'
    });
  }
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

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // 设置customId为socket.id，用于WebRTC信令
  socket.customId = socket.id;

  // 用户加入聊天室
  socket.on('join', async (userData) => {
    const user = {
      id: socket.id,
      nickname: userData.nickname,
      isOnline: true,
      joinTime: new Date().toISOString()
    };
    
    onlineUsers.set(socket.id, user);
    
    // 通知其他用户有新用户加入
    socket.broadcast.emit('userJoined', user);
    
    // 发送当前在线用户列表
    io.emit('users', Array.from(onlineUsers.values()));
    
    // 发送历史消息
    try {
      const messageHistory = await getMessages();
      socket.emit('messages', messageHistory);
      console.log(`Sent ${messageHistory.length} messages to ${user.nickname}`);
    } catch (error) {
      console.error('Error sending message history:', error);
      socket.emit('messages', []);
    }
    
    console.log(`User ${user.nickname} joined the chatroom`);
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
const PORT = process.env.PORT || 3001;
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
