// vercel-library-api/api/books/related.js
import { connectToDatabase, ObjectId } from '../../lib/database.js';

/**
 * 相关图书推荐API
 * 根据图书ID和分类推荐相关图书
 */
export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('books');
    
    // 解析查询参数
    const {
      bookId,
      category = '',
      limit = 8
    } = req.query;
    
    if (!bookId) {
      return res.status(400).json({
        success: false,
        error: '图书ID不能为空'
      });
    }
    
    console.log(`🔗 获取相关推荐: bookId=${bookId}, category=${category}, limit=${limit}`);
    
    // 构建查询条件
    const query = {
      _id: { $ne: bookId }, // 排除当前图书
      status: 'available'   // 只推荐可借的图书
    };
    
    // 如果指定了分类，优先推荐同分类图书
    if (category && category.trim()) {
      query.category = category.trim();
    }
    
    // 执行查询，按借阅量和评分排序
    const relatedBooks = await collection
      .find(query)
      .sort({
        borrowCount: -1,  // 优先推荐热门图书
        rating: -1,       // 其次按评分
        createdAt: -1     // 最后按创建时间
      })
      .limit(Math.min(20, parseInt(limit)))
      .toArray();
    
    // 如果同分类图书不够，补充其他分类的图书
    if (relatedBooks.length < parseInt(limit)) {
      const remainingLimit = parseInt(limit) - relatedBooks.length;
      const existingIds = relatedBooks.map(book => book._id);
      existingIds.push(bookId); // 也要排除原始图书
      
      const additionalBooks = await collection
        .find({
          _id: { $nin: existingIds },
          status: 'available',
          ...(category ? { category: { $ne: category } } : {}) // 排除已搜索的分类
        })
        .sort({
          borrowCount: -1,
          rating: -1,
          createdAt: -1
        })
        .limit(remainingLimit)
        .toArray();
      
      relatedBooks.push(...additionalBooks);
    }
    
    // 格式化结果数据
    const books = relatedBooks.map(book => ({
      id: book._id,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      category: book.category,
      status: book.status,
      borrowCount: book.borrowCount,
      rating: book.rating,
      coverImage: book.coverImage || ''
    }));
    
    console.log(`✅ 找到 ${books.length} 本相关图书`);
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: books,
      total: books.length,
      query: {
        bookId,
        category: category || '',
        limit: parseInt(limit)
      },
      cached: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取相关推荐失败:', error);
    
    res.status(500).json({
      success: false,
      error: '获取相关推荐失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
