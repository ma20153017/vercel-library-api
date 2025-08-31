// api/users/status.js - 获取用户借阅状态接口
const { getCollection, handleDatabaseError, cacheManager, ObjectId } = require('../../lib/database');

module.exports = async function handler(req, res) {
  try {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: '只支持GET请求'
      });
    }

    // 获取用户ID
    const { userId, studentId, openid } = req.query;
    
    if (!userId && !studentId && !openid) {
      return res.status(400).json({
        success: false,
        error: '缺少用户标识参数',
        details: '请提供userId、studentId或openid参数'
      });
    }

    console.log(`👤 开始获取用户状态数据: ${userId || studentId || openid}`);

    // 检查缓存
    const cacheKey = `user_status_${userId || studentId || openid}`;
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ 从缓存获取用户状态数据');
      return res.status(200).json({
        success: true,
        data: cachedData,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // 构建用户查询条件
    let userQuery = {};
    if (userId) {
      userQuery.userId = userId;
    }
    if (studentId) {
      userQuery.studentId = studentId;
    }
    if (openid) {
      userQuery.openid = openid;
    }

    // 获取集合
    const borrowsCollection = await getCollection('borrows');
    const favoritesCollection = await getCollection('favorites');
    const usersCollection = await getCollection('users');

    // 并行查询用户相关数据
    const [borrowRecords, favoriteRecords, userInfo] = await Promise.all([
      // 查询借阅记录
      borrowsCollection.find(userQuery).toArray(),
      
      // 查询收藏记录
      favoritesCollection.find(userQuery).toArray(),
      
      // 查询用户基本信息
      usersCollection.findOne(userQuery)
    ]);

    console.log(`📖 找到 ${borrowRecords.length} 条借阅记录`);
    console.log(`❤️ 找到 ${favoriteRecords.length} 条收藏记录`);

    // 处理借阅数据
    const allBorrows = borrowRecords || [];
    const currentBorrows = allBorrows.filter(record => record.status === 'borrowed');
    const overdueBooks = currentBorrows.filter(record => {
      if (!record.dueDate) return false;
      const dueDate = new Date(record.dueDate);
      return dueDate < new Date();
    });

    // 处理收藏数据
    const favoriteBooks = favoriteRecords || [];

    // 计算借阅统计
    const borrowStats = {
      currentBorrows: currentBorrows.length,
      overdueBooks: overdueBooks.length,
      totalBorrows: allBorrows.length,
      favoriteBooks: favoriteBooks.length,
      returnedBooks: allBorrows.filter(record => record.status === 'returned').length
    };

    // 获取最近借阅的图书（用于推荐）
    const recentBorrows = allBorrows
      .sort((a, b) => new Date(b.borrowDate) - new Date(a.borrowDate))
      .slice(0, 5);

    // 获取即将到期的图书
    const upcomingDue = currentBorrows
      .filter(record => record.dueDate)
      .map(record => ({
        ...record,
        daysUntilDue: Math.ceil((new Date(record.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
      }))
      .filter(record => record.daysUntilDue <= 7 && record.daysUntilDue >= 0)
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // 用户活跃度评分（基于借阅频率和按时归还率）
    let activityScore = 0;
    if (allBorrows.length > 0) {
      const returnedOnTime = allBorrows.filter(record => {
        if (record.status !== 'returned' || !record.dueDate || !record.returnDate) return true;
        return new Date(record.returnDate) <= new Date(record.dueDate);
      }).length;
      
      const onTimeRate = returnedOnTime / allBorrows.length;
      const borrowFrequency = Math.min(allBorrows.length / 10, 1); // 最多10本满分
      
      activityScore = Math.round((onTimeRate * 0.6 + borrowFrequency * 0.4) * 100);
    }

    // 获取偏好分类
    const preferredCategories = await getPreferredCategories(allBorrows);

    const userStatus = {
      // 基础统计
      ...borrowStats,
      
      // 用户基本信息
      userInfo: userInfo ? {
        name: userInfo.name || '未设置',
        studentId: userInfo.studentId || '',
        avatar: userInfo.avatar || '',
        joinDate: userInfo.createdAt || new Date().toISOString()
      } : null,
      
      // 详细信息
      recentBorrows: recentBorrows.map(record => ({
        id: record._id?.toString(),
        bookId: record.bookId,
        bookTitle: record.bookTitle || '',
        borrowDate: record.borrowDate,
        dueDate: record.dueDate,
        status: record.status
      })),
      
      upcomingDue: upcomingDue.map(record => ({
        id: record._id?.toString(),
        bookId: record.bookId,
        bookTitle: record.bookTitle || '',
        dueDate: record.dueDate,
        daysUntilDue: record.daysUntilDue
      })),
      
      // 用户活跃度
      activityScore,
      
      // 推荐类别（基于借阅历史）
      preferredCategories,
      
      // 时间戳
      lastUpdated: new Date().toISOString()
    };

    // 如果是新用户（没有任何记录），返回默认状态
    if (allBorrows.length === 0 && favoriteBooks.length === 0) {
      const defaultStatus = {
        currentBorrows: 0,
        overdueBooks: 0,
        totalBorrows: 0,
        favoriteBooks: 0,
        returnedBooks: 0,
        userInfo: userInfo ? {
          name: userInfo.name || '新用户',
          studentId: userInfo.studentId || '',
          avatar: userInfo.avatar || '',
          joinDate: userInfo.createdAt || new Date().toISOString()
        } : {
          name: '新用户',
          studentId: studentId || '',
          avatar: '',
          joinDate: new Date().toISOString()
        },
        recentBorrows: [],
        upcomingDue: [],
        activityScore: 0,
        preferredCategories: [],
        isNewUser: true,
        recommendations: [
          { category: '技术', reason: '热门分类推荐' },
          { category: '文学', reason: '经典阅读推荐' },
          { category: '科学', reason: '知识拓展推荐' }
        ],
        lastUpdated: new Date().toISOString()
      };

      // 缓存结果（1分钟，新用户数据变化较快）
      cacheManager.set(cacheKey, defaultStatus, 60000);

      console.log('📝 返回新用户默认状态');

      return res.status(200).json({
        success: true,
        data: defaultStatus,
        message: '新用户，返回默认状态',
        cached: false,
        timestamp: new Date().toISOString()
      });
    }

    // 缓存结果（3分钟）
    cacheManager.set(cacheKey, userStatus, 180000);

    console.log(`✅ 成功获取用户状态数据`);

    return res.status(200).json({
      success: true,
      data: userStatus,
      cached: false,
      query: { userId, studentId, openid },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取用户状态失败:', error);
    
    const errorResponse = handleDatabaseError(error, '获取用户状态');
    
    return res.status(500).json({
      success: false,
      error: errorResponse.error,
      code: errorResponse.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

// 辅助函数：获取用户偏好分类
async function getPreferredCategories(borrowRecords) {
  try {
    if (borrowRecords.length === 0) return [];

    // 获取books集合
    const booksCollection = await getCollection('books');

    // 获取所有借阅的图书ID
    const bookIds = borrowRecords
      .map(record => {
        try {
          return typeof record.bookId === 'string' 
            ? new ObjectId(record.bookId) 
            : record.bookId;
        } catch (err) {
          console.warn('无效的图书ID:', record.bookId);
          return null;
        }
      })
      .filter(id => id !== null);

    if (bookIds.length === 0) return [];

    // 查询这些图书的分类信息
    const books = await booksCollection
      .find(
        { _id: { $in: bookIds } },
        { projection: { category: 1, _id: 1 } }
      )
      .toArray();

    // 统计分类频率
    const categoryCount = {};
    books.forEach(book => {
      if (book.category) {
        categoryCount[book.category] = (categoryCount[book.category] || 0) + 1;
      }
    });

    // 返回按频率排序的前3个分类
    return Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, count]) => ({
        category,
        count,
        percentage: Math.round((count / borrowRecords.length) * 100)
      }));

  } catch (error) {
    console.error('获取偏好分类失败:', error);
    return [];
  }
}