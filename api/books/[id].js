// vercel-library-api/api/books/[id].js
import { connectToDatabase, ObjectId } from '../../lib/database.js';

/**
 * 图书详情API
 * 根据图书ID获取详细信息
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
    
    // 从URL路径中获取图书ID
    const bookId = req.query.id;
    
    if (!bookId) {
      return res.status(400).json({
        success: false,
        error: '图书ID不能为空'
      });
    }
    
    console.log(`📖 获取图书详情: ${bookId}`);
    
    // 查找图书
    let book;
    try {
      // 尝试按ObjectId查询
      if (ObjectId.isValid(bookId)) {
        book = await collection.findOne({ _id: new ObjectId(bookId) });
      }
      
      // 如果没找到，尝试按UUID查询
      if (!book) {
        book = await collection.findOne({ _id: bookId });
      }
      
      // 如果还没找到，尝试按图书编号查询
      if (!book) {
        book = await collection.findOne({ acno: bookId });
      }
      
    } catch (error) {
      console.error('查询图书时出错:', error);
      // 如果ObjectId格式错误，尝试其他方式查询
      book = await collection.findOne({ $or: [{ _id: bookId }, { acno: bookId }] });
    }
    
    if (!book) {
      return res.status(404).json({
        success: false,
        error: '图书不存在',
        bookId: bookId
      });
    }
    
    console.log(`✅ 找到图书: ${book.title}`);
    
    // 格式化图书数据
    const bookDetail = {
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
      description: book.description || '',
      coverImage: book.coverImage || '',
      isbn: book.isbn || '',
      publishDate: book.publishDate || '',
      pages: book.pages || 0,
      price: book.price || 0,
      callno: book.callno || '',
      createdAt: book.createdAt,
      updatedAt: book.updatedAt
    };
    
    // 返回结果
    res.status(200).json({
      success: true,
      data: bookDetail,
      cached: false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 获取图书详情失败:', error);
    
    res.status(500).json({
      success: false,
      error: '获取图书详情失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
}
