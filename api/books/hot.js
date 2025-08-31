// api/books/hot.js - 获取热门图书接口
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

    // 获取查询参数
    const { limit = 10, category } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    // 连接数据库
    const db = await connectToDatabase();
    
    if (!db) {
      throw new Error('数据库连接失败');
    }

    console.log(`🔥 开始获取热门图书数据，限制 ${limitNum} 本...`);

    // 构建查询条件
    let query = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    // 获取热门图书（按借阅次数排序）
    const booksResult = await db.collection('books')
      .where(query)
      .orderBy('borrowCount', 'desc')
      .orderBy('rating', 'desc')
      .limit(limitNum)
      .get();

    console.log(`📚 查询到 ${booksResult.data.length} 本热门图书`);

    // 处理图书数据
    const hotBooks = await Promise.all(booksResult.data.map(async (book) => {
      try {
        // 获取封面图片临时链接
        let coverUrl = book.coverImage;
        if (book.coverImage && book.coverImage.startsWith('cloud://')) {
          try {
            const tempResult = await db.getTempFileURL({
              fileList: [book.coverImage]
            });
            if (tempResult.fileList && tempResult.fileList[0]) {
              coverUrl = tempResult.fileList[0].tempFileURL;
            }
          } catch (err) {
            console.warn('获取封面临时链接失败:', err);
            coverUrl = '/images/default-book.png';
          }
        }

        // 计算评分（如果没有评分，根据借阅次数估算）
        let rating = book.rating;
        if (!rating && book.borrowCount) {
          rating = Math.min(5.0, 3.5 + (book.borrowCount / 100) * 1.5);
          rating = Math.round(rating * 10) / 10;
        }

        return {
          id: book._id,
          title: book.title || '未知书名',
          author: book.author || '未知作者',
          cover: coverUrl || '/images/default-book.png',
          status: book.status || 'available',
          rating: rating || 4.0,
          borrowCount: book.borrowCount || 0,
          category: book.category || '其他',
          description: book.description || '',
          isbn: book.isbn || '',
          publisher: book.publisher || '',
          location: book.location || {},
          totalCopies: book.totalCopies || 1,
          availableCopies: book.availableCopies || (book.status === 'available' ? 1 : 0)
        };
      } catch (err) {
        console.error('处理图书数据出错:', err);
        return {
          id: book._id,
          title: book.title || '未知书名',
          author: book.author || '未知作者',
          cover: '/images/default-book.png',
          status: 'available',
          rating: 4.0,
          borrowCount: 0
        };
      }
    }));

    // 如果没有数据，返回模拟数据
    if (hotBooks.length === 0) {
      const mockBooks = [
        {
          id: 'mock_001',
          title: 'JavaScript高级程序设计',
          author: 'Nicholas C. Zakas',
          cover: '/images/books/js_book.jpg',
          status: 'available',
          rating: 4.8,
          borrowCount: 156,
          category: '技术',
          description: 'JavaScript权威指南，深入解析JavaScript语言特性'
        },
        {
          id: 'mock_002',
          title: '深入理解计算机系统',
          author: 'Randal E. Bryant',
          cover: '/images/books/csapp.jpg',
          status: 'borrowed',
          rating: 4.9,
          borrowCount: 203,
          category: '计算机科学',
          description: '从程序员角度学习计算机系统的工作原理'
        }
      ];

      return res.status(200).json({
        success: true,
        data: mockBooks,
        total: mockBooks.length,
        message: '返回模拟热门图书数据',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`✅ 成功获取 ${hotBooks.length} 本热门图书`);

    return res.status(200).json({
      success: true,
      data: hotBooks,
      total: hotBooks.length,
      query: { limit: limitNum, category },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取热门图书失败:', error);
    
    return res.status(500).json({
      success: false,
      error: '获取热门图书失败',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

