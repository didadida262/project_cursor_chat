import mongoose from 'mongoose';

// 测试 MongoDB 连接
async function testMongoDBConnection() {
  const MONGODB_URI = process.env.MONGODB_URI;
  
  console.log('🔍 测试 MongoDB 连接...');
  console.log('MongoDB URI:', MONGODB_URI ? '已设置' : '未设置');
  
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI 环境变量未设置');
    return;
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 连接成功！');
    
    // 测试数据库操作
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 数据库集合:', collections.map(c => c.name));
    
    await mongoose.disconnect();
    console.log('🔌 MongoDB 连接已断开');
    
  } catch (error) {
    console.error('❌ MongoDB 连接失败:', error.message);
  }
}

testMongoDBConnection();
