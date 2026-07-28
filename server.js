const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite DB
const dbPath = path.join(__dirname, 'data', 'students.db');
const db = new Database(dbPath, { readonly: true });

// Arabic text normalizer helper
function normalizeArabic(text) {
    if (!text) return '';
    return text
        .replace(/[أإآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[\u064B-\u0652]/g, '') // remove tashkeel
        .toLowerCase()
        .trim();
}

// 1. Search and Filter API
app.get('/api/students', (req, res) => {
    try {
        const {
            query = '',
            status = 'ALL',
            minDegree = 0,
            maxDegree = 320,
            sortBy = 'seating_no',
            order = 'ASC',
            page = 1,
            limit = 25
        } = req.query;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(200, Math.max(10, parseInt(limit) || 25));
        const offset = (pageNum - 1) * limitNum;

        let conditions = [];
        let params = [];

        // Search query filter
        const cleanQuery = query.trim();
        if (cleanQuery) {
            if (/^\d+$/.test(cleanQuery)) {
                // If numeric, search seating number exact or prefix match
                conditions.push(`seating_no LIKE ?`);
                params.push(`${cleanQuery}%`);
            } else {
                // Search normalized name
                const norm = normalizeArabic(cleanQuery);
                conditions.push(`normalized_name LIKE ?`);
                params.push(`%${norm}%`);
            }
        }

        // Status filter
        if (status && status !== 'ALL') {
            conditions.push(`student_case_desc = ?`);
            params.push(status);
        }

        // Degree filter
        const minDeg = parseFloat(minDegree) || 0;
        const maxDeg = parseFloat(maxDegree) || 320;
        conditions.push(`total_degree >= ? AND total_degree <= ?`);
        params.push(minDeg, maxDeg);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Allowed sort columns
        const allowedSort = {
            'seating_no': 'CAST(seating_no AS INTEGER)',
            'total_degree': 'total_degree',
            'arabic_name': 'arabic_name'
        };
        const sortColumn = allowedSort[sortBy] || 'CAST(seating_no AS INTEGER)';
        const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        // Count query
        const countSql = `SELECT COUNT(*) as total FROM students ${whereClause}`;
        const totalCount = db.prepare(countSql).get(...params).total;

        // Data query
        const dataSql = `
            SELECT id, seating_no, arabic_name, total_degree, student_case_desc 
            FROM students 
            ${whereClause} 
            ORDER BY ${sortColumn} ${sortOrder} 
            LIMIT ? OFFSET ?
        `;
        const rows = db.prepare(dataSql).all(...params, limitNum, offset);

        const totalPages = Math.ceil(totalCount / limitNum) || 1;

        res.json({
            success: true,
            total: totalCount,
            page: pageNum,
            limit: limitNum,
            totalPages: totalPages,
            data: rows
        });

    } catch (err) {
        console.error('Error fetching students:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Statistics API
app.get('/api/stats', (req, res) => {
    try {
        const totalStudents = db.prepare('SELECT COUNT(*) as cnt FROM students').get().cnt;
        const passStudents = db.prepare("SELECT COUNT(*) as cnt FROM students WHERE student_case_desc = 'ناجح دور أول'").get().cnt;
        const avgDegree = db.prepare('SELECT AVG(total_degree) as avg FROM students').get().avg;
        const maxDegree = db.prepare('SELECT MAX(total_degree) as max FROM students').get().max;
        
        const statusBreakdown = db.prepare(`
            SELECT student_case_desc as status, COUNT(*) as count 
            FROM students 
            GROUP BY student_case_desc
        `).all();

        res.json({
            success: true,
            stats: {
                totalStudents,
                passStudents,
                passRate: ((passStudents / totalStudents) * 100).toFixed(1),
                avgDegree: avgDegree ? avgDegree.toFixed(2) : 0,
                maxDegree: maxDegree || 0,
                statusBreakdown
            }
        });
    } catch (err) {
        console.error('Error fetching stats:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Export CSV API
app.get('/api/export', (req, res) => {
    try {
        const { query = '', status = 'ALL', minDegree = 0, maxDegree = 320 } = req.query;

        let conditions = [];
        let params = [];

        const cleanQuery = query.trim();
        if (cleanQuery) {
            if (/^\d+$/.test(cleanQuery)) {
                conditions.push(`seating_no LIKE ?`);
                params.push(`${cleanQuery}%`);
            } else {
                const norm = normalizeArabic(cleanQuery);
                conditions.push(`normalized_name LIKE ?`);
                params.push(`%${norm}%`);
            }
        }

        if (status && status !== 'ALL') {
            conditions.push(`student_case_desc = ?`);
            params.push(status);
        }

        conditions.push(`total_degree >= ? AND total_degree <= ?`);
        params.push(parseFloat(minDegree) || 0, parseFloat(maxDegree) || 320);

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT seating_no, arabic_name, total_degree, student_case_desc FROM students ${whereClause} ORDER BY CAST(seating_no AS INTEGER) ASC LIMIT 50000`;

        const rows = db.prepare(sql).all(...params);

        // Build CSV output with UTF-8 BOM
        let csv = '\uFEFFرقم الجلوس,اسم الطالب,المجموع الكلي,النسبة المئوية,حالة الطالب\n';
        for (const r of rows) {
            const pct = ((r.total_degree / 320) * 100).toFixed(1) + '%';
            csv += `"${r.seating_no}","${r.arabic_name.replace(/"/g, '""')}","${r.total_degree}","${pct}","${r.student_case_desc}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="نتائج_الطلاب.csv"');
        res.send(csv);

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(` Server is running on http://localhost:${PORT}`);
});
