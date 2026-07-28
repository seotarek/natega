// Student Results Web Application JS Logic
document.addEventListener('DOMContentLoaded', () => {
    
    // State variables
    let currentPage = 1;
    let currentQuery = '';
    let currentStatus = 'ALL';
    let currentSortBy = 'seating_no';
    let currentOrder = 'ASC';
    let currentLimit = 25;
    let debounceTimer = null;

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

    // 1. Fetch Stats on Load
    fetchStats();

    // 2. Fetch Students Data
    fetchStudents();

    // Search Input Event (Debounced 300ms)
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentQuery = e.target.value;
            currentPage = 1;
            fetchStudents();
        }, 300);
    });

    // Status Pill Filter Event
    statusPills.addEventListener('click', (e) => {
        const btn = e.target.closest('.pill-btn');
        if (!btn) return;
        
        statusPills.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        currentStatus = btn.dataset.status;
        currentPage = 1;
        fetchStudents();
    });

    // Sort By Change Event
    sortBySelect.addEventListener('change', (e) => {
        const [sort, order] = e.target.value.split('-');
        currentSortBy = sort;
        currentOrder = order;
        currentPage = 1;
        fetchStudents();
    });

    // Limit Change Event
    limitSelect.addEventListener('change', (e) => {
        currentLimit = parseInt(e.target.value) || 25;
        currentPage = 1;
        fetchStudents();
    });

    // Export CSV Event
    exportBtn.addEventListener('click', () => {
        const params = new URLSearchParams({
            query: currentQuery,
            status: currentStatus
        });
        window.location.href = `/api/export?${params.toString()}`;
    });

    // Modal Close
    closeModalBtn.addEventListener('click', () => {
        studentModal.classList.remove('show');
    });

    studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) {
            studentModal.classList.remove('show');
        }
    });

    printCertBtn.addEventListener('click', () => {
        window.print();
    });

    // Fetch Stats function
    async function fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.success) {
                const s = data.stats;
                document.getElementById('statTotal').innerText = Number(s.totalStudents).toLocaleString('ar-EG');
                document.getElementById('statPassRate').innerText = `${s.passRate}%`;
                document.getElementById('statAvgDegree').innerText = `${s.avgDegree} / 320`;
                
                const secRoundObj = s.statusBreakdown.find(x => x.status === 'دور ثان');
                if (secRoundObj) {
                    document.getElementById('statSecondRound').innerText = Number(secRoundObj.count).toLocaleString('ar-EG');
                }
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    // Fetch Students function
    async function fetchStudents() {
        loadingSpinner.style.display = 'block';
        resultsTableBody.style.opacity = '0.5';

        try {
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
        } catch (err) {
            console.error('Error loading students:', err);
            resultsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 30px;">حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.</td></tr>`;
        } finally {
            loadingSpinner.style.display = 'none';
            resultsTableBody.style.opacity = '1';
        }
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

            // Score badge color
            let scoreClass = 'mid';
            if (pct >= 85) scoreClass = 'high';
            else if (pct >= 75) scoreClass = 'mid';
            else if (pct >= 50) scoreClass = 'low';
            else scoreClass = 'fail';

            // Status tag color
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

        // Attach modal triggers
        document.querySelectorAll('.view-student-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const s = JSON.parse(btn.dataset.student);
                openStudentModal(s);
            });
        });
    }

    // Open Modal Details
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

    // Highlight Query Matches
    function highlightText(text, query) {
        if (!query || query.trim() === '' || /^\d+$/.test(query.trim())) return text;
        const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${q})`, 'gi');
        return text.replace(regex, `<mark style="background: rgba(245, 158, 11, 0.35); color: #fef08a; padding: 2px 4px; border-radius: 4px;">$1</mark>`);
    }

    // Render Pagination Controls
    function renderPagination(total, page, limit, totalPages) {
        resultsCountText.innerText = `${Number(total).toLocaleString('ar-EG')} طالب`;
        pageMetaText.innerText = `صفحة ${page} من ${Number(totalPages).toLocaleString('ar-EG')}`;

        const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
        const endIdx = Math.min(page * limit, total);
        paginationInfoText.innerText = `عرض ${startIdx} - ${endIdx} من إجمالي ${Number(total).toLocaleString('ar-EG')}`;

        let html = '';

        // Previous button
        html += `<button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}"><i class="fa-solid fa-chevron-right"></i> السابقة</button>`;

        // Page numbers logic (Max 5 page buttons shown)
        let startPage = Math.max(1, page - 2);
        let endPage = Math.min(totalPages, startPage + 4);

        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

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

        // Next button
        html += `<button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">التالية <i class="fa-solid fa-chevron-left"></i></button>`;

        paginationControls.innerHTML = html;

        // Attach pagination click handlers
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
