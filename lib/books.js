const fs = require('fs');
const path = require('path');

// 图书数据文件路径
const booksDataPath = path.join(process.cwd(), 'data', 'books.json');

/**
 * 获取所有图书
 * @returns {Promise<Array>} 图书列表
 */
async function getAllBooks() {
  try {
    const data = fs.readFileSync(booksDataPath, 'utf8');
    return JSON.parse(data).books;
  } catch (error) {
    console.error('读取图书数据失败:', error);
    return []; 
  }
}

/**
 * 根据ID查找图书
 * @param {string} id 图书ID
 * @returns {Promise<Object|null>} 图书对象或null
 */
async function getBookById(id) {
  try {
    const books = await getAllBooks();
    return books.find(book => book.id === id) || null;
  } catch (error) {
    console.error('查找图书失败:', error);
    return null;
  }
}

/**
 * 按分类获取图书
 * @param {string} category 分类名称
 * @returns {Promise<Array>} 图书列表
 */
async function getBooksByCategory(category) {
  try {
    const books = await getAllBooks();
    if (!category || category === 'all') {
      return books;
    }
    return books.filter(book => book.category.includes(category));
  } catch (error) {
    console.error('按分类获取图书失败:', error);
    return [];
  }
}

/**
 * 按关键词搜索图书
 * @param {string} keyword 搜索关键词
 * @returns {Promise<Array>} 符合条件的图书列表
 */
async function searchBooks(keyword) {
  if (!keyword) return [];

  try {
    const books = await getAllBooks();
    const lowerKeyword = keyword.toLowerCase();

    return books.filter(book => {
      // 检查标题、作者、关键词和分类
      return (
        book.title.toLowerCase().includes(lowerKeyword) ||
        book.author.toLowerCase().includes(lowerKeyword) ||
        (book.keywords && book.keywords.some(k => k.toLowerCase().includes(lowerKeyword))) ||
        (book.category && book.category.some(c => c.toLowerCase().includes(lowerKeyword)))
      );
    });
  } catch (error) {
    console.error('搜索图书失败:', error);
    return [];
  }
}

module.exports = {
  getAllBooks,
  getBookById,
  getBooksByCategory,
  searchBooks
}; 