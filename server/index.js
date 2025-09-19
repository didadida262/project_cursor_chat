import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(express.json());

// 存储在线用户
const onlineUsers = new Map();
const messages = [];

// 路由
app.get('/', (req, res) => {
  res.json({ 
    message: 'Chatroom Server is running',
    onlineUsers: onlineUsers.size,
    totalMessages: messages.length
  });
});

app.get('/api/users', (req, res) => {
  res.json(Array.from(onlineUsers.values()));
});

app.get('/api/messages', (req, res) => {
  res.json(messages);
});

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 用户加入聊天室
  socket.on('join', (userData) => {
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
    socket.emit('messages', messages.slice(-50)); // 只发送最近50条消息
    
    console.log(`User ${user.nickname} joined the chatroom`);
  });

  // 处理消息
  socket.on('message', (messageData) => {
    const message = {
      id: uuidv4(),
      userId: messageData.userId,
      nickname: messageData.nickname,
      message: messageData.message,
      timestamp: new Date().toISOString()
    };
    
    messages.push(message);
    
    // 限制消息历史数量
    if (messages.length > 1000) {
      messages.splice(0, messages.length - 1000);
    }
    
    // 广播消息给所有用户
    io.emit('message', message);
    
    console.log(`Message from ${message.nickname}: ${message.message}`);
  });

  // WebRTC 信令处理
  socket.on('offer', (offer) => {
    socket.broadcast.emit('offer', offer);
  });

  socket.on('answer', (answer) => {
    socket.broadcast.emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate) => {
    socket.broadcast.emit('ice-candidate', candidate);
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
