// api/books/hot.js - 获取热门图书接口
const { getCollection, handleDatabaseError, cacheManager } = require('../../lib/database');

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

    // 获取查询参数
    const { limit = 10, category } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    console.log(`🔥 开始获取热门图书数据，限制 ${limitNum} 本...`);

    // 检查缓存
    const cacheKey = `hot_books_${category || 'all'}_${limitNum}`;
    const cachedData = cacheManager.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ 从缓存获取热门图书数据');
      return res.status(200).json({
        success: true,
        data: cachedData,
        total: cachedData.length,
        cached: true,
        timestamp: new Date().toISOString()
      });
    }

    // 获取books集合
    const booksCollection = await getCollection('books');

    // 构建查询条件
    let query = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    // 获取热门图书（按借阅次数和评分排序）
    const hotBooks = await booksCollection
      .find(query)
      .sort({ borrowCount: -1, rating: -1, createdAt: -1 })
      .limit(limitNum)
      .toArray();

    console.log(`📚 查询到 ${hotBooks.length} 本热门图书`);

    // 处理图书数据
    const processedBooks = hotBooks.map((book) => {
      try {
        // 计算评分（如果没有评分，根据借阅次数估算）
        let rating = book.rating;
        if (!rating && book.borrowCount) {
          rating = Math.min(5.0, 3.5 + (book.borrowCount / 100) * 1.5);
          rating = Math.round(rating * 10) / 10;
        }

        return {
          id: book._id.toString(),
          title: book.title || '未知书名',
          author: book.author || '未知作者',
          cover: book.coverImage || '/images/default-book.png',
          status: book.status || 'available',
          rating: rating || 4.0,
          borrowCount: book.borrowCount || 0,
          category: book.category || '其他',
          subcategory: book.subcategory || '',
          description: book.description || '',
          isbn: book.isbn || '',
          publisher: book.publisher || '',
          publishDate: book.publishDate || '',
          location: book.location || {},
          totalCopies: book.totalCopies || 1,
          availableCopies: book.availableCopies || (book.status === 'available' ? 1 : 0),
          tags: book.tags || [],
          createdAt: book.createdAt || new Date().toISOString(),
          updatedAt: book.updatedAt || new Date().toISOString()
        };
      } catch (err) {
        console.error('处理图书数据出错:', err);
        return {
          id: book._id.toString(),
          title: book.title || '未知书名',
          author: book.author || '未知作者',
          cover: '/images/default-book.png',
          status: 'available',
          rating: 4.0,
          borrowCount: 0,
          category: '其他'
        };
      }
    });

    // 如果没有数据，返回默认示例数据
    if (processedBooks.length === 0) {
      const mockBooks = [
        {
          id: 'example_001',
          title: 'JavaScript高级程序设计（第4版）',
          author: 'Matt Frisbie',
          cover: '/images/books/js-book.jpg',
          status: 'available',
          rating: 4.8,
          borrowCount: 156,
          category: '技术',
          subcategory: '编程语言',
          description: 'JavaScript权威指南，深入解析JavaScript语言特性和最佳实践。',
          isbn: '978-7-115-54562-6',
          publisher: '人民邮电出版社',
          publishDate: '2020-09-01',
          location: { floor: 3, area: 'A', shelf: '001', position: '05' },
          totalCopies: 3,
          availableCopies: 2,
          tags: ['编程', 'JavaScript', '前端开发'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'example_002',
          title: '深入理解计算机系统（第3版）',
          author: 'Randal E. Bryant',
          cover: '/images/books/csapp.jpg',
          status: 'available',
          rating: 4.9,
          borrowCount: 203,
          category: '技术',
          subcategory: '计算机科学',
          description: '从程序员角度学习计算机系统的工作原理，经典教材。',
          isbn: '978-7-111-54493-7',
          publisher: '机械工业出版社',
          publishDate: '2016-11-01',
          location: { floor: 3, area: 'A', shelf: '002', position: '12' },
          totalCopies: 2,
          availableCopies: 1,
          tags: ['计算机系统', '操作系统', '计算机原理'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'example_003',
          title: '算法导论（第3版）',
          author: 'Thomas H. Cormen',
          cover: '/images/books/algorithms.jpg',
          status: 'borrowed',
          rating: 4.7,
          borrowCount: 89,
          category: '技术',
          subcategory: '算法数据结构',
          description: '算法和数据结构领域的经典教材，适合深入学习。',
          isbn: '978-7-111-40701-0',
          publisher: '机械工业出版社',
          publishDate: '2013-01-01',
          location: { floor: 3, area: 'A', shelf: '003', position: '08' },
          totalCopies: 1,
          availableCopies: 0,
          tags: ['算法', '数据结构', '理论'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'example_004',
          title: '设计模式：可复用面向对象软件的基础',
          author: 'Erich Gamma',
          cover: '/images/books/design-patterns.jpg',
          status: 'available',
          rating: 4.6,
          borrowCount: 127,
          category: '技术',
          subcategory: '软件工程',
          description: '面向对象设计模式的经典著作，软件开发必读。',
          isbn: '978-7-111-21116-6',
          publisher: '机械工业出版社',
          publishDate: '2007-09-01',
          location: { floor: 3, area: 'B', shelf: '001', position: '03' },
          totalCopies: 2,
          availableCopies: 2,
          tags: ['设计模式', '面向对象', '软件设计'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // 根据分类过滤示例数据
      let filteredMockBooks = mockBooks;
      if (category && category !== 'all') {
        filteredMockBooks = mockBooks.filter(book => 
          book.category.toLowerCase() === category.toLowerCase()
        );
      }

      // 限制数量
      filteredMockBooks = filteredMockBooks.slice(0, limitNum);

      console.log(`📝 返回 ${filteredMockBooks.length} 本示例热门图书`);

      return res.status(200).json({
        success: true,
        data: filteredMockBooks,
        total: filteredMockBooks.length,
        message: '暂无真实数据，返回示例热门图书',
        query: { limit: limitNum, category },
        timestamp: new Date().toISOString()
      });
    }

    // 缓存结果（2分钟）
    cacheManager.set(cacheKey, processedBooks, 120000);

    console.log(`✅ 成功获取 ${processedBooks.length} 本热门图书`);

    return res.status(200).json({
      success: true,
      data: processedBooks,
      total: processedBooks.length,
      cached: false,
      query: { limit: limitNum, category },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 获取热门图书失败:', error);
    
    const errorResponse = handleDatabaseError(error, '获取热门图书');
    
    return res.status(500).json({
      success: false,
      error: errorResponse.error,
      code: errorResponse.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
};