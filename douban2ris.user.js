// ==UserScript==
// @name         豆瓣读书一键导出RIS
// @name:en      douban to RIS citation
// @name:zh      豆瓣读书一键导出RIS
// @namespace    https://greasyfork.org/en/scripts/567853-%E8%B1%86%E7%93%A3%E8%AF%BB%E4%B9%A6%E4%B8%80%E9%94%AE%E5%AF%BC%E5%87%BAris
// @author       alpsprice
// @homepageURL  https://github.com/alpsprice/douban2ris/
// @version      1.0
// @license      MIT
// @description  将豆瓣图书一键导出RIS格式文献引用（支持作者、译者、出版社、ISBN等）
// @description:en  an easy way to export douban book to *.ris citation!
// @match        *://book.douban.com/subject/*
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ========== 按钮 ==========
    GM_addStyle(`
        .top-nav-export {
            float: right;
            margin-left: 12px;
            line-height: 28px;
        }
        .top-nav-export .export-btn {
            display: inline-block;
            padding: 0 12px;
            background-color: #4CAF50;
            color: white !important;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 500;
            text-decoration: none;
            cursor: pointer;
            transition: background-color 0.2s;
            border: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .top-nav-export .export-btn:hover {
            background-color: #45a049;
        }
    `);

    // ========== 等待页面加载完成后执行 ==========
    window.addEventListener('load', function() {
        // 只对图书详情页生效
        createExportButton();
    });

    // ========== 创建导出按钮 ==========
    function createExportButton() {
        // 定位右上角容器（在豆瓣APP下载链接后面插入）
        const target = document.querySelector('.top-nav-doubanapp');
        if (!target) return; // 未找到目标位置，放弃

        // 检查是否已存在相同按钮，避免重复插入
        if (document.querySelector('.top-nav-export')) return;

        // 创建按钮容器
        const exportDiv = document.createElement('div');
        exportDiv.className = 'top-nav-export';

        const btn = document.createElement('a');
        btn.className = 'export-btn';
        btn.textContent = '导出RIS';
        btn.href = '#';
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            exportAsRIS();
        });

        exportDiv.appendChild(btn);
        target.insertAdjacentElement('afterend', exportDiv);
    }

    // ========== 核心：提取图书信息并生成RIS文件 ==========
    function exportAsRIS() {
        const bookData = extractBookInfo();
        if (!bookData.title) {
            alert('无法提取图书标题，请确认当前页面为图书详情页。');
            return;
        }

        const risContent = buildRIS(bookData);
        downloadRIS(risContent, (bookData.title || 'book') + '.ris');
    }

    // 从豆瓣页面抓取数据
    function extractBookInfo() {
        const info = document.getElementById('info');
        if (!info) return {};

        // 标题
        const titleElem = document.querySelector('h1 span[property="v:itemreviewed"]') || document.querySelector('h1');
        const title = titleElem ? titleElem.textContent.trim() : '';

        // 准备容器
        let authors = [];       // 主要作者
        let publisher = '';
        let pubYear = '';
        let isbn = '';
        let pages = '';
        let series = '';

        // 遍历所有带 .pl 的项
        const plSpans = info.querySelectorAll('.pl');
        plSpans.forEach(span => {
            const label = span.textContent.trim();

            // 处理作者
            if (label.includes('作者')) {
                let next = span.nextSibling;
                // 跳过空白文本
                while (next && next.nodeType === Node.TEXT_NODE && !next.textContent.trim()) {
                    next = next.nextSibling;
                }
                // 收集后续所有的<a>直到遇到下一个.pl或换行
                const authorLinks = [];
                let current = next;
                while (current && !(current.nodeType === Node.ELEMENT_NODE && current.classList && current.classList.contains('pl'))) {
                    if (current.nodeType === Node.ELEMENT_NODE && current.tagName === 'A') {
                        authorLinks.push(current);
                    }
                    current = current.nextSibling;
                }
                authors = authorLinks.map(a => a.textContent.trim());
            }
            // 出版社
            else if (label.includes('出版社')) {
                const next = span.nextElementSibling;
                if (next && next.tagName === 'A') {
                    publisher = next.textContent.trim();
                }
            }
            // 出版年
            else if (label.includes('出版年')) {
                const next = span.nextSibling;
                if (next && next.nodeType === Node.TEXT_NODE) {
                    pubYear = next.textContent.trim();
                }
            }
            // ISBN
            else if (label.includes('ISBN')) {
                const next = span.nextSibling;
                if (next && next.nodeType === Node.TEXT_NODE) {
                    isbn = next.textContent.trim();
                }
            }
            // 页数
            else if (label.includes('页数')) {
                const next = span.nextSibling;
                if (next && next.nodeType === Node.TEXT_NODE) {
                    pages = next.textContent.trim();
                }
            }
            // 丛书
            else if (label.includes('丛书')) {
                const next = span.nextElementSibling;
                if (next && next.tagName === 'A') {
                    series = next.textContent.trim();
                }
            }
        });

        return {
            title: title,
            authors: authors,
            publisher: publisher,
            pubYear: pubYear,
            isbn: isbn,
            pages: pages,
            series: series
        };
    }

    // 构建RIS格式字符串
    function buildRIS(data) {
        const lines = [];

        // 类型：图书
        lines.push('TY  - BOOK');

        // 主要作者
        if (data.authors && data.authors.length) {
            data.authors.forEach(author => {
                lines.push('AU  - ' + author);
            });
        }

        // 标题
        if (data.title) {
            lines.push('TI  - ' + data.title);
        }

        // 出版年
        if (data.pubYear) {
            // 提取四位数字年份（例如“2014-11” -> 2014）
            const yearMatch = data.pubYear.match(/\d{4}/);
            if (yearMatch) {
                lines.push('PY  - ' + yearMatch[0]);
            } else {
                lines.push('PY  - ' + data.pubYear);
            }
        }

        // 出版社
        if (data.publisher) {
            lines.push('PB  - ' + data.publisher);
        }

        // ISBN
        if (data.isbn) {
            lines.push('SN  - ' + data.isbn);
        }

        // 页数
        if (data.pages) {
            lines.push('SP  - ' + data.pages);
        }

        // 丛书放入系列
        if (data.series) {
            lines.push('T2  - ' + data.series);
        }

        // 结束
        lines.push('ER  - ');

        return lines.join('\r\n');
    }

    // 下载RIS文件
    function downloadRIS(content, filename) {
        const blob = new Blob([content], { type: 'application/x-research-info-sources;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
    }
})();