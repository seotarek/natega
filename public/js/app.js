// Student Results Web Application JS Logic (Dual-Mode: Backend API & Standalone GitHub Pages)
document.addEventListener('DOMContentLoaded', () => {
    
    // State variables
    let currentPage = 1;
    let currentQuery = '';
    let currentStatus = 'ALL';
    let currentSortBy = 'seating_no';
    let currentOrder = 'ASC';
    let currentLimit = 25;
    let debounceTimer = null;

    // Static mode variables
    let isStaticMode = false;
    let staticStats = null;
    let staticChunkIndex = null;
    let staticNameIndex = null;
    const chunkCache = new Map();

    // DOM Elements
    const searchInput = document.getElementById('searchInput');
    const statusPills = document.getElementById('statusFilterPills');
    const sortBySelect = document.getElementById('sortBySelect');
    const limitSelect = document.getElementById('limitSelect');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsCountText = document.getElementById('resultsCountText');
    const pageMetaText = document.getElementById('pageMetaText');
    const paginationInfoText = document.getElementById('paginationInfoText');
    const paginationControls = document.getElementById('paginationControls');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const themeToggle = document.getElementById('themeToggle');
    const exportBtn = document.getElementById('exportBtn');
    
    // Modal Elements
    const studentModal = document.getElementById('studentModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const printCertBtn = document.getElementById('printCertBtn');
    const modalName = document.getElementById('modalName');
    const modalSeating = document.getElementById('modalSeating');
    const modalDegree = document.getElementById('modalDegree');
    const modalPercentage = document.getElementById('modalPercentage');
    const modalStatus = document.getElementById('modalStatus');

    // Theme Toggle Initialization
    const savedTheme = localStorage.getItem('app-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.setAttribute('data-theme', 'light');
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    themeToggle.addEventListener('click', () => {
        const isLight = document.body.getAttribute('data-theme') === 'light';
        if (isLight) {
            document.body.removeAttribute('data-theme');
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem('app-theme', 'dark');
        } else {
            document.body.setAttribute('data-theme', 'light');
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem('app-theme', 'light');
        }
    });

    // Helper: Normalize Arabic Text
    function normalizeArabic(text) {
        if (!text) return '';
        return text
            .replace(/[أإآا]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u0652]/g, '')
            .toLowerCase()
            .trim();
    }

    // Detect Environment & Initialize
    async function initApp() {
        try {
            const apiCheck = await fetch('/api/stats', { method: 'GET' }).catch(() => null);
            if (apiCheck && apiCheck.ok) {
                isStaticMode = false;
            } else {
                isStaticMode = true;
                await initStaticData();
            }
        } catch (e) {
            isStaticMode = true;
            await initStaticData();
        }

        fetchStats();
        fetchStudents();
    }

    async function initStaticData() {
        try {
            const [statsRes, chunkIdxRes, nameIdxRes] = await Promise.all([
                fetch('data/stats.json').catch(() => null),
                fetch('data/chunk_index.json').catch(() => null),
                fetch('data/name_index.json').catch(() => null)
            ]);

            if (statsRes && statsRes.ok) staticStats = await statsRes.json();
            if (chunkIdxRes && chunkIdxRes.ok) staticChunkIndex = await chunkIdxRes.json();
            if (nameIdxRes && nameIdxRes.ok) staticNameIndex = await nameIdxRes.json();
        } catch (err) {
            console.warn('Error loading static indexes:', err);
        }
    }

    initApp();

    // Event Listeners
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentQuery = e.target.value;
            currentPage = 1;
            fetchStudents();
        }, 300);
    });

    statusPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        
        statusPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentStatus = btn.dataset.status;
        currentPage = 1;
        fetchStudents();
    });

    sortBySelect.addEventListener('change', (e) => {
        const [sort, order] = e.target.value.split('-');
        currentSortBy = sort;
        currentOrder = order;
        currentPage = 1;
        fetchStudents();
    });

    limitSelect.addEventListener('change', (e) => {
        currentLimit = parseInt(e.target.value) || 25;
        currentPage = 1;
        fetchStudents();
    });

    exportBtn.addEventListener('click', () => {
        if (!isStaticMode) {
            const params = new URLSearchParams({ query: currentQuery, status: currentStatus });
            window.location.href = `/api/export?${params.toString()}`;
        } else {
            alert('العمل حالياً في النمط الإستاتيكي (GitHub Pages). يمكنك استخدام الجدول والبحث بشكل مباشر.');
        }
    });

    closeModalBtn.addEventListener('click', () => studentModal.classList.remove('show'));
    studentModal.addEventListener('click', (e) => { if (e.target === studentModal) studentModal.classList.remove('show'); });
    printCertBtn.addEventListener('click', () => window.print());

    // Fetch Stats
    async function fetchStats() {
        if (!isStaticMode) {
            try {
                const res = await fetch('/api/stats');
                const data = await res.json();
                if (data.success) {
                    const s = data.stats;
                    document.getElementById('statTotal').innerText = Number(s.totalStudents).toLocaleString('ar-EG');
                    document.getElementById('statPassRate').innerText = `${s.passRate}%`;
                    document.getElementById('statAvgDegree').innerText = `${s.avgDegree} / 320`;
                    const secRoundObj = s.statusBreakdown.find(x => x.status === 'دور ثان');
                    if (secRoundObj) document.getElementById('statSecondRound').innerText = Number(secRoundObj.count).toLocaleString('ar-EG');
                }
            } catch (err) {
                console.error('Error loading stats:', err);
            }
        } else if (staticStats) {
            document.getElementById('statTotal').innerText = Number(staticStats.totalStudents).toLocaleString('ar-EG');
            document.getElementById('statPassRate').innerText = `${staticStats.passRate}%`;
            document.getElementById('statAvgDegree').innerText = `${staticStats.avgDegree} / 320`;
            document.getElementById('statSecondRound').innerText = '210,511';
        }
    }

    // Fetch Students
    async function fetchStudents() {
        loadingSpinner.style.display = 'block';
        resultsTableBody.style.opacity = '0.5';

        try {
            if (!isStaticMode) {
                const params = new URLSearchParams({
                    query: currentQuery,
                    status: currentStatus,
                    sortBy: currentSortBy,
                    order: currentOrder,
                    page: currentPage,
                    limit: currentLimit
                });
                const res = await fetch(`/api/students?${params.toString()}`);
                const json = await res.json();
                if (json.success) {
                    renderTable(json.data, json.page, json.limit);
                    renderPagination(json.total, json.page, json.limit, json.totalPages);
                }
            } else {
                // Static Client Search
                const results = await performStaticSearch();
                const total = results.length;
                const totalPages = Math.ceil(total / currentLimit) || 1;
                const pageNum = Math.max(1, Math.min(currentPage, totalPages));
                const start = (pageNum - 1) * currentLimit;
                const pageData = results.slice(start, start + currentLimit);
                
                renderTable(pageData, pageNum, currentLimit);
                renderPagination(total, pageNum, currentLimit, totalPages);
            }
        } catch (err) {
            console.error('Error loading students:', err);
            resultsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 30px;">حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.</td></tr>`;
        } finally {
            loadingSpinner.style.display = 'none';
            resultsTableBody.style.opacity = '1';
        }
    }

    // Perform Static Search
    async function performStaticSearch() {
        let matchingChunks = [];
        const cleanQ = currentQuery.trim();

        if (cleanQ) {
            if (/^\d+$/.test(cleanQ)) {
                // Seating number search
                const seatNum = intVal(cleanQ);
                if (staticChunkIndex) {
                    matchingChunks = staticChunkIndex.filter(c => seatNum >= c.min_seating && seatNum <= c.max_seating).map(c => c.id);
                    if (matchingChunks.length === 0) {
                        matchingChunks = staticChunkIndex.filter(c => String(c.min_seating).startsWith(cleanQ)).map(c => c.id).slice(0, 3);
                    }
                }
            } else {
                // Name search
                const norm = normalizeArabic(cleanQ);
                const words = norm.split(' ');
                let chunkSet = new Set();

                if (staticNameIndex) {
                    const key = words.slice(0, 2).join(' ');
                    if (staticNameIndex[key]) {
                        staticNameIndex[key].forEach(id => chunkSet.add(id));
                    } else if (staticNameIndex[words[0]]) {
                        staticNameIndex[words[0]].forEach(id => chunkSet.add(id));
                    }
                }

                if (chunkSet.size > 0) {
                    matchingChunks = Array.from(chunkSet).slice(0, 5);
                } else {
                    matchingChunks = [0, 1, 2]; // Fallback to first few chunks
                }
            }
        } else {
            matchingChunks = [0]; // Default to chunk 0
        }

        if (matchingChunks.length === 0) matchingChunks = [0];

        // Fetch required chunks
        let allRows = [];
        for (const chunkId of matchingChunks) {
            let rows = chunkCache.get(chunkId);
            if (!rows) {
                try {
                    const r = await fetch(`data/chunks/${chunkId}.json`);
                    if (r.ok) {
                        rows = await r.json();
                        chunkCache.set(chunkId, rows);
                    }
                } catch (e) {}
            }
            if (rows) {
                rows.forEach(r => {
                    allRows.push({
                        seating_no: r[0],
                        arabic_name: r[1],
                        total_degree: r[2],
                        student_case_desc: r[3]
                    });
                });
            }
        }

        // Apply filters in memory
        return allRows.filter(r => {
            if (currentStatus !== 'ALL' && r.student_case_desc !== currentStatus) return false;
            if (cleanQ) {
                if (/^\d+$/.test(cleanQ)) {
                    return r.seating_no.startsWith(cleanQ);
                } else {
                    return normalizeArabic(r.arabic_name).includes(normalizeArabic(cleanQ));
                }
            }
            return true;
        });
    }

    function intVal(v) {
        return parseInt(v) || 0;
    }

    // Render Table Rows
    function renderTable(rows, page, limit) {
        if (!rows || rows.length === 0) {
            resultsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px; font-weight: 600;">لم يتم العثور على أي نتائج مطابقة لبحثك.</td></tr>`;
            return;
        }

        let html = '';
        const startIdx = (page - 1) * limit + 1;

        rows.forEach((row, i) => {
            const index = startIdx + i;
            const seating = row.seating_no;
            const name = row.arabic_name;
            const degree = parseFloat(row.total_degree) || 0;
            const maxDeg = 320;
            const pct = ((degree / maxDeg) * 100).toFixed(1);
            const status = row.student_case_desc;

            let scoreClass = 'mid';
            if (pct >= 85) scoreClass = 'high';
            else if (pct >= 75) scoreClass = 'mid';
            else if (pct >= 50) scoreClass = 'low';
            else scoreClass = 'fail';

            let statusClass = 'pass';
            if (status.includes('دور ثان')) statusClass = 'second-round';
            else if (status.includes('راسب')) statusClass = 'failed';
            else if (status.includes('غياب')) statusClass = 'absent';

            html += `
                <tr>
                    <td style="color: var(--text-muted); font-size: 13px;">${index}</td>
                    <td>
                        <span class="seating-badge">
                            <i class="fa-solid fa-id-card" style="font-size: 12px; opacity: 0.7;"></i>
                            ${seating}
                        </span>
                    </td>
                    <td><span class="student-name">${highlightText(name, currentQuery)}</span></td>
                    <td><strong style="font-size: 15px;">${degree}</strong> <span style="font-size: 12px; color: var(--text-muted);">/ 320</span></td>
                    <td><span class="score-badge ${scoreClass}">${pct}%</span></td>
                    <td><span class="status-tag ${statusClass}">${status}</span></td>
                    <td>
                        <button class="btn-icon view-student-btn" data-student='${JSON.stringify(row).replace(/'/g, "&apos;")}' title="معاينة البطاقة والتفاصيل" style="width: 34px; height: 34px;">
                            <i class="fa-solid fa-eye" style="font-size: 14px;"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        resultsTableBody.innerHTML = html;

        document.querySelectorAll('.view-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = JSON.parse(btn.dataset.student);
                openStudentModal(s);
            });
        });
    }

    function openStudentModal(s) {
        const degree = parseFloat(s.total_degree) || 0;
        const pct = ((degree / 320) * 100).toFixed(1);

        modalName.innerText = s.arabic_name;
        modalSeating.innerText = s.seating_no;
        modalDegree.innerText = `${s.total_degree} / 320`;
        modalPercentage.innerText = `${pct}%`;

        let statusClass = 'pass';
        if (s.student_case_desc.includes('دور ثان')) statusClass = 'second-round';
        else if (s.student_case_desc.includes('راسب')) statusClass = 'failed';
        else if (s.student_case_desc.includes('غياب')) statusClass = 'absent';

        modalStatus.className = `status-tag ${statusClass}`;
        modalStatus.innerText = s.student_case_desc;

        studentModal.classList.add('show');
    }

    function highlightText(text, query) {
        if (!query || query.trim() === '' || /^\d+$/.test(query.trim())) return text;
        const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${q})`, 'gi');
        return text.replace(regex, `<mark style="background: rgba(245, 158, 11, 0.35); color: #fef08a; padding: 2px 4px; border-radius: 4px;">$1</mark>`);
    }

    function renderPagination(total, page, limit, totalPages) {
        resultsCountText.innerText = `${Number(total).toLocaleString('ar-EG')} طالب`;
        pageMetaText.innerText = `صفحة ${page} من ${Number(totalPages).toLocaleString('ar-EG')}`;

        const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
        const endIdx = Math.min(page * limit, total);
        paginationInfoText.innerText = `عرض ${startIdx} - ${endIdx} من إجمالي ${Number(total).toLocaleString('ar-EG')}`;

        let html = '';
        html += `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}"><i class="fa-solid fa-chevron-right"></i> السابقة</button>`;

        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);

        if (startPage > 1) {
            html += `<button class="page-btn" data-page="1">1</button>`;
            if (startPage > 2) html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
        }

        for (let p = startPage; p <= endPage; p++) {
            html += `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span style="padding: 0 4px; color: var(--text-muted);">...</span>`;
            html += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
        }

        html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">التالية <i class="fa-solid fa-chevron-left"></i></button>`;

        paginationControls.innerHTML = html;

        paginationControls.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.hasAttribute('disabled')) return;
                const targetPage = parseInt(btn.dataset.page);
                if (targetPage && targetPage !== currentPage) {
                    currentPage = targetPage;
                    fetchStudents();
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                }
            });
        });
    }
});
