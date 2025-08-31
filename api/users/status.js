// api/users/status.js - 获取用户借阅状态接口
import { connectToDatabase } from '../../lib/database.js';

export default async function handler(req, res) {
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
    const { userId, studentId } = req.query;
    
    if (!userId && !studentId) {
      return res.status(400).json({
        success: false,
        error: '缺少用户ID或学号参数',
        details: '请提供userId或studentId参数'
      });
    }

    // 连接数据库
    const db = await connectToDatabase();
    
    if (!db) {
      throw new Error('数据库连接失败');
    }

    console.log(`👤 开始获取用户状态数据: ${userId || studentId}`);

    // 构建用户查询条件
    let userQuery = {};
    if (userId) {
      userQuery.userId = userId;
    }
    if (studentId) {
      userQuery.studentId = studentId;
    }

    // 并行查询用户相关数据
    const [borrowRecords, favoriteRecords] = await Promise.all([
      // 查询借阅记录
      db.collection('borrowRecords')
        .where(userQuery)
        .get(),
      
      // 查询收藏记录
      db.collection('userFavorites')
        .where(userQuery)
        .get()
    ]);

    console.log(`📖 找到 ${borrowRecords.data.length} 条借阅记录`);
    console.log(`❤️ 找到 ${favoriteRecords.data.length} 条收藏记录`);

    // 处理借阅数据
    const allBorrows = borrowRecords.data || [];
    const currentBorrows = allBorrows.filter(record => record.status === 'borrowed');
    const overdueBooks = currentBorrows.filter(record => {
      if (!record.dueDate) return false;
      const dueDate = new Date(record.dueDate);
      return dueDate < new Date();
    });

    // 处理收藏数据
    const favoriteBooks = favoriteRecords.data || [];

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

    const userStatus = {
      // 基础统计
      ...borrowStats,
      
      // 详细信息
      recentBorrows: recentBorrows.map(record => ({
        bookId: record.bookId,
        borrowDate: record.borrowDate,
        status: record.status
      })),
      
      upcomingDue: upcomingDue.map(record => ({
        bookId: record.bookId,
        dueDate: record.dueDate,
        daysUntilDue: record.daysUntilDue
      })),
      
      // 用户活跃度
      activityScore,
      
      // 推荐类别（基于借阅历史）
      preferredCategories: await getPreferredCategories(db, allBorrows),
      
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
        recentBorrows: [],
        upcomingDue: [],
        activityScore: 0,
        preferredCategories: [],
        isNewUser: true,
        lastUpdated: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        data: defaultStatus,
        message: '新用户，返回默认状态',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ 成功获取用户状态数据`);

    return res.status(200).json({
      success: true,
      data: userStatus,
      query: { userId, studentId },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取用户状态失败:', error);
    
    return res.status(500).json({
      success: false,
      error: '获取用户状态失败',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// 辅助函数：获取用户偏好分类
async function getPreferredCategories(db, borrowRecords) {
  try {
    if (borrowRecords.length === 0) return [];

    // 获取所有借阅的图书ID
    const bookIds = borrowRecords.map(record => record.bookId);
    
    // 查询这些图书的分类信息
    const booksResult = await db.collection('books')
      .where({
        _id: db.command.in(bookIds)
      })
      .field({
        category: true
      })
      .get();

    // 统计分类频率
    const categoryCount = {};
    booksResult.data.forEach(book => {
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

