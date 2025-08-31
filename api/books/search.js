// vercel-library-api/api/books/search.js
import { connectToDatabase, ObjectId } from '../../lib/database.js';

/**
 * 图书搜索API
 * 支持关键词搜索、分页、排序、筛选
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
      q: keyword = '',           // 搜索关键词
      page = 1,                  // 页码
      limit = 20,                // 每页数量
      sortBy = 'relevance',      // 排序方式: relevance, borrowCount, title, author, publishDate
      category = '',             // 分类筛选
      language = '',             // 语言筛选
      status = '',               // 状态筛选: available, borrowed
      author = '',               // 作者筛选
      publisher = ''             // 出版社筛选
    } = req.query;

    console.log('🔍 搜索请求参数:', {
      keyword, page, limit, sortBy, category, language, status, author, publisher
    });

    // 构建搜索查询
    const searchQuery = {};
    const sortOptions = {};
    
    // 关键词搜索
    if (keyword && keyword.trim()) {
      const keywordRegex = new RegExp(keyword.trim(), 'i');
      searchQuery.$or = [
        { title: keywordRegex },
        { author: keywordRegex },
        { publisher: keywordRegex },
        { subject: keywordRegex },
        { callno: keywordRegex },
        { acno: keywordRegex }
      ];
    }
    
    // 分类筛选
    if (category && category.trim()) {
      searchQuery.category = category.trim();
    }
    
    // 语言筛选  
    if (language && language.trim()) {
      searchQuery.language = language.trim();
    }
    
    // 状态筛选
    if (status && status.trim()) {
      searchQuery.status = status.trim();
    }
    
    // 作者筛选
    if (author && author.trim()) {
      searchQuery.author = new RegExp(author.trim(), 'i');
    }
    
    // 出版社筛选
    if (publisher && publisher.trim()) {
      searchQuery.publisher = new RegExp(publisher.trim(), 'i');
    }
    
    // 排序选项
    switch (sortBy) {
      case 'borrowCount':
        sortOptions.borrowCount = -1;
        sortOptions.title = 1;
        break;
      case 'title':
        sortOptions.title = 1;
        break;
      case 'author':
        sortOptions.author = 1;
        sortOptions.title = 1;
        break;
      case 'publishDate':
        sortOptions.publishDate = -1;
        sortOptions.title = 1;
        break;
      case 'relevance':
      default:
        // 相关度排序：借阅量 + 标题匹配
        if (keyword && keyword.trim()) {
          sortOptions.borrowCount = -1;
          sortOptions.title = 1;
        } else {
          sortOptions.borrowCount = -1;
          sortOptions.createdAt = -1;
        }
        break;
    }
    
    console.log('📊 MongoDB查询:', JSON.stringify(searchQuery, null, 2));
    console.log('📋 排序选项:', sortOptions);
    
    // 计算分页参数
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // 限制最大50条
    const skip = (pageNum - 1) * limitNum;
    
    // 执行搜索
    const [results, totalCount] = await Promise.all([
      collection
        .find(searchQuery)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      collection.countDocuments(searchQuery)
    ]);
    
    // 处理结果数据
    const books = results.map(book => ({
      id: book._id,
      acno: book.acno,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      category: book.category,
      subject: book.subject,
      language: book.language,
      status: book.status,
      totalCopies: book.totalCopies,
      availableCopies: book.availableCopies,
      borrowCount: book.borrowCount,
      rating: book.rating,
      tags: book.tags || [],
      coverImage: book.coverImage,
      callno: book.callno,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt
    }));
    
    // 计算分页信息
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;
    
    console.log(`✅ 搜索完成: 找到 ${totalCount} 本图书，返回第 ${pageNum} 页 ${books.length} 条记录`);
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: books,
      pagination: {
        current: pageNum,
        total: totalPages,
        limit: limitNum,
        hasNext: hasNextPage,
        hasPrev: hasPrevPage
      },
      total: totalCount,
      query: {
        keyword: keyword || '',
        page: pageNum,
        limit: limitNum,
        sortBy,
        filters: {
          category: category || '',
          language: language || '',
          status: status || '',
          author: author || '',
          publisher: publisher || ''
        }
      },
      cached: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 图书搜索失败:', error);
    
    res.status(500).json({
      success: false,
      error: '图书搜索失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
