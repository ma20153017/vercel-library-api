// lib/database.js - MongoDB Atlas 数据库连接模块
const { MongoClient, ObjectId } = require('mongodb');

// 数据库连接池
let cachedClient = null;
let cachedDb = null;

/**
 * MongoDB Atlas 连接配置
 */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ma20153017_db_user:dz4o48EV2ACF4C24@smart-library-cluster.zqouztr.mongodb.net/smart_library?retryWrites=true&w=majority';
const DB_NAME = 'smart_library';

/**
 * 连接到MongoDB Atlas数据库
 */
async function connectToDatabase() {
  try {
    // 如果已有缓存连接，直接返回
    if (cachedDb && cachedClient) {
      return { client: cachedClient, db: cachedDb };
    }

    console.log('🔌 正在连接MongoDB Atlas...');

    // 创建MongoDB客户端
    if (!cachedClient) {
      cachedClient = new MongoClient(MONGODB_URI, {
        maxPoolSize: 10, // 连接池大小
        serverSelectionTimeoutMS: 5000, // 服务器选择超时
        socketTimeoutMS: 45000, // Socket超时
        connectTimeoutMS: 10000, // 连接超时
        retryWrites: true // 启用重试写入
      });

      // 连接到MongoDB
      await cachedClient.connect();
      console.log('✅ MongoDB Atlas 客户端连接成功');
    }

    // 获取数据库实例
    if (!cachedDb) {
      cachedDb = cachedClient.db(DB_NAME);
      
      // 测试连接
      await cachedDb.admin().ping();
      console.log('✅ MongoDB Atlas 数据库连接成功');
    }
    
    return { client: cachedClient, db: cachedDb };

  } catch (error) {
    console.error('❌ MongoDB Atlas 连接失败:', error);
    
    // 清理失败的连接
    cachedClient = null;
    cachedDb = null;
    
    throw new Error(`MongoDB连接失败: ${error.message}`);
  }
}

/**
 * 获取集合
 */
async function getCollection(collectionName) {
  try {
    const { db } = await connectToDatabase();
    return db.collection(collectionName);
  } catch (error) {
    console.error(`❌ 获取集合 ${collectionName} 失败:`, error);
    throw error;
  }
}

/**
 * 关闭数据库连接
 */
async function closeConnection() {
  try {
    if (cachedClient) {
      await cachedClient.close();
      cachedClient = null;
      cachedDb = null;
      console.log('✅ MongoDB 连接已关闭');
    }
  } catch (error) {
    console.error('❌ 关闭MongoDB连接失败:', error);
  }
}

/**
 * 数据库查询辅助函数
 */
const dbUtils = {
  
  /**
   * 分页查询
   */
  async paginate(collection, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { _id: -1 },
      filter = {}
    } = options;

    const skip = (page - 1) * limit;
    
    try {
      const [data, total] = await Promise.all([
        collection
          .find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .toArray(),
        collection.countDocuments(filter)
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      };
    } catch (error) {
      console.error('分页查询失败:', error);
      throw error;
    }
  },

  /**
   * 聚合查询
   */
  async aggregate(collection, pipeline) {
    try {
      const result = await collection.aggregate(pipeline).toArray();
      return result;
    } catch (error) {
      console.error('聚合查询失败:', error);
      throw error;
    }
  },

  /**
   * 批量操作
   */
  async batchOperation(collection, operations) {
    try {
      const results = [];
      
      for (const op of operations) {
        let result;
        
        switch (op.type) {
          case 'insert':
            result = await collection.insertOne(op.data);
            break;
          case 'update':
            result = await collection.updateOne(
              { _id: new ObjectId(op.id) }, 
              { $set: op.data }
            );
            break;
          case 'delete':
            result = await collection.deleteOne({ _id: new ObjectId(op.id) });
            break;
          default:
            throw new Error(`不支持的操作类型: ${op.type}`);
        }
        
        results.push(result);
      }
      
      return results;
    } catch (error) {
      console.error('批量操作失败:', error);
      throw error;
    }
  },

  /**
   * 创建索引
   */
  async createIndexes(collection, indexes) {
    try {
      if (!Array.isArray(indexes) || indexes.length === 0) {
        return;
      }
      
      const result = await collection.createIndexes(indexes);
      console.log(`✅ 创建索引成功:`, result);
      return result;
    } catch (error) {
      console.error('创建索引失败:', error);
      throw error;
    }
  }
};

/**
 * 缓存管理（保持原有功能）
 */
const cacheManager = {
  cache: new Map(),
  
  /**
   * 设置缓存
   */
  set(key, value, ttl = 300000) { // 默认5分钟过期
    const expireTime = Date.now() + ttl;
    this.cache.set(key, { value, expireTime });
  },
  
  /**
   * 获取缓存
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  },
  
  /**
   * 删除缓存
   */
  delete(key) {
    this.cache.delete(key);
  },
  
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }
};

/**
 * 错误处理辅助函数
 */
function handleDatabaseError(error, operation) {
  console.error(`数据库操作失败 [${operation}]:`, error);
  
  // 根据错误类型返回不同的错误信息
  if (error.message.includes('authentication')) {
    return { error: '数据库认证失败', code: 'AUTH_ERROR' };
  }
  
  if (error.message.includes('network') || error.message.includes('timeout')) {
    return { error: '数据库连接超时', code: 'NETWORK_ERROR' };
  }
  
  if (error.message.includes('MongoServerError')) {
    return { error: '数据库服务器错误', code: 'SERVER_ERROR' };
  }
  
  return { error: '数据库操作失败', code: 'DATABASE_ERROR', details: error.message };
}

/**
 * 数据库状态检查
 */
async function getDatabaseConnectionStatus() {
  try {
    const { db } = await connectToDatabase();
    await db.admin().ping();
    return {
      connected: true,
      database: DB_NAME,
      status: 'healthy'
    };
  } catch (error) {
    return {
      connected: false,
      database: DB_NAME,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * 初始化数据库（创建集合和索引）
 */
async function initializeDatabase() {
  try {
    console.log('🔧 正在初始化数据库...');
    
    const { db } = await connectToDatabase();
    
    // 创建集合
    const collections = [
      'books',           // 图书
      'categories',      // 分类
      'users',          // 用户
      'borrows',        // 借阅记录
      'favorites'       // 收藏
    ];
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName);
        console.log(`✅ 集合 ${collectionName} 创建成功`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`📝 集合 ${collectionName} 已存在`);
        } else {
          throw error;
        }
      }
    }
    
    // 创建索引
    const booksCollection = db.collection('books');
    await dbUtils.createIndexes(booksCollection, [
      { key: { title: 'text', author: 'text', description: 'text' } }, // 全文搜索
      { key: { category: 1 } }, // 分类索引
      { key: { status: 1 } },   // 状态索引
      { key: { createdAt: -1 } } // 创建时间索引
    ]);
    
    const usersCollection = db.collection('users');
    await dbUtils.createIndexes(usersCollection, [
      { key: { openid: 1 }, unique: true }, // 用户唯一标识
      { key: { studentId: 1 } }  // 学号索引
    ]);
    
    const borrowsCollection = db.collection('borrows');
    await dbUtils.createIndexes(borrowsCollection, [
      { key: { userId: 1 } },    // 用户ID索引
      { key: { bookId: 1 } },    // 图书ID索引
      { key: { status: 1 } },    // 状态索引
      { key: { borrowDate: -1 } } // 借阅时间索引
    ]);
    
    console.log('✅ 数据库初始化完成');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}

// 导出模块
module.exports = {
  connectToDatabase,
  getCollection,
  closeConnection,
  dbUtils,
  cacheManager,
  handleDatabaseError,
  getDatabaseConnectionStatus,
  initializeDatabase,
  ObjectId // 导出ObjectId供其他模块使用
};