import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// ===== Konfigurasi Supabase =====
const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== Konstanta Paginasi =====
const PAGE_SIZE = 20;

// ===== Elemen DOM =====
const el = {
    grid:             document.getElementById('movies-grid'),
    search:           document.getElementById('search-input'),
    searchBtn:        document.getElementById('search-btn'),
    catBtns:          document.querySelectorAll('.category-btn'),
    tabBtns:          document.querySelectorAll('.tab-btn'),
    paginationWrapper: document.getElementById('pagination-wrapper'),
    nextPageBtn:      document.getElementById('next-page-btn'),
};

// ===== State =====
let allMovies      = [];
let filteredMovies = [];   // daftar film setelah filter & sort
let currentPage    = 0;    // halaman yang sedang ditampilkan (mulai dari 0)
let currentCat     = 'all';
let currentTab     = 'recommended';
let currentSearch  = '';

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadMovies();
});

// ===== Event Listeners =====
function setupEventListeners() {
    el.searchBtn.addEventListener('click', handleSearch);
    el.search.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });

    el.catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCat = btn.dataset.category;
            resetAndFilter();
        });
    });

    el.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            resetAndFilter();
        });
    });

    // Tombol Selanjutnya
    if (el.nextPageBtn) {
        el.nextPageBtn.addEventListener('click', () => {
            currentPage++;
            renderPage();
            // Gulir ke bagian card baru yang muncul
            el.grid.scrollIntoView({ behavior: 'smooth', block: 'end' });
        });
    }
}

// ===== Reset halaman & filter ulang =====
function resetAndFilter() {
    currentPage = 0;
    filterMovies();
}

// ===== Load Movies dari Supabase (tanpa limit — paginasi di sisi klien) =====
async function loadMovies() {
    showLoading();
    try {
        const { data, error } = await supabase
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allMovies = data || [];
        filterMovies();
    } catch (err) {
        console.error('Error loading movies:', err);
        el.grid.innerHTML = `<div class="no-movies"><p>Gagal memuat film. Silakan refresh halaman.</p></div>`;
    }
}

// ===== Loading State =====
function showLoading() {
    el.grid.innerHTML = `
        <div class="loading-movies">
            <div class="spinner"></div>
            <p>Memuat film...</p>
        </div>`;
}

// ===== Handle Search =====
function handleSearch() {
    currentSearch = el.search.value.trim().toLowerCase();
    currentPage = 0;
    filterMovies();
}

// ===== Fisher-Yates Shuffle =====
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ===== Generate Thumbnail URL =====
function generateThumbnailUrl(videoUrl, movieTitle = '') {
    if (!videoUrl) return 'https://placehold.co/400x225/1a1a1a/ffffff?text=No+Video';

    // YouTube
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let videoId;
        if (videoUrl.includes('youtube.com/watch?v=')) {
            videoId = new URL(videoUrl).searchParams.get('v');
        } else if (videoUrl.includes('youtu.be/')) {
            videoId = videoUrl.split('youtu.be/')[1].split('?')[0];
        }
        if (videoId && videoId.length === 11) {
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }

    // Google Drive
    if (videoUrl.includes('drive.google.com')) {
        let fileId;
        if (videoUrl.includes('/file/d/')) {
            fileId = videoUrl.split('/file/d/')[1].split('/')[0];
        } else if (videoUrl.includes('id=')) {
            fileId = new URL(videoUrl).searchParams.get('id');
        }
        if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}=s400`;
    }

    // Cloudflare R2
    if (videoUrl.includes('r2.dev') || videoUrl.includes('cloudflarestorage.com')) {
        const baseName = videoUrl.split('/').pop().split('.')[0] || 'Video';
        let label = movieTitle?.trim() || baseName.replace(/[-_]/g, ' ');
        if (label.length > 20) label = label.substring(0, 20) + '...';
        return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(label)}`;
    }

    // Vimeo
    if (videoUrl.includes('vimeo.com')) {
        const videoId = videoUrl.split('vimeo.com/')[1]?.split('/')[0]?.split('?')[0];
        if (videoId && /^\d+$/.test(videoId)) return `https://vumbnail.com/${videoId}.jpg`;
    }

    // Default
    const shortTitle = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
    return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(shortTitle || 'Video')}`;
}

// ===== Aspect Ratio Class =====
function getAspectRatioClass(ratio) {
    const map = { '16:9': 'aspect-16-9', '9:16': 'aspect-9-16', '3:4': 'aspect-3-4', '4:3': 'aspect-4-3' };
    return map[ratio] || 'aspect-16-9';
}

// ===== Category Display Name =====
function getCategoryDisplayName(category) {
    const map = { colmek: 'COLMEK', berdua: 'BERDUA', bergilir: 'BERGILIR', lainnya: 'LAINNYA' };
    return map[category] || category.toUpperCase();
}

// ===== Format Views =====
function formatViews(views) {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}JT`;
    if (views >= 1_000)     return `${(views / 1_000).toFixed(1)}K`;
    return views.toString();
}

// ===== Filter Movies (reset ke halaman 0) =====
function filterMovies() {
    let list = [...allMovies];

    // Filter kategori
    if (currentCat !== 'all') {
        list = list.filter(m => (m.category?.toLowerCase() || 'lainnya') === currentCat);
    }

    // Sort / acak sesuai tab
    if (currentTab === 'latest') {
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentTab === 'popular') {
        list.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else {
        list = shuffleArray(list);
    }

    // Filter search
    if (currentSearch) {
        list = list.filter(m =>
            m.title?.toLowerCase().includes(currentSearch) ||
            m.description?.toLowerCase().includes(currentSearch)
        );
    }

    filteredMovies = list;
    currentPage    = 0;
    renderPage();
}

// ===== Render halaman saat ini (kumulatif: tampilkan 0 s/d (page+1)*PAGE_SIZE) =====
function renderPage() {
    const end     = (currentPage + 1) * PAGE_SIZE;
    const visible = filteredMovies.slice(0, end);

    if (!visible.length) {
        el.grid.innerHTML = `<div class="no-movies"><p>Tidak ada film yang ditemukan.</p></div>`;
        updatePaginationBtn(false);
        return;
    }

    el.grid.innerHTML = visible.map(movie => buildMovieCard(movie)).join('');

    // Klik ke halaman detail
    el.grid.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `detail.html?id=${card.dataset.id}`;
        });
    });

    // Tampilkan / sembunyikan tombol Selanjutnya
    updatePaginationBtn(filteredMovies.length > end);
}

// ===== Perbarui visibilitas tombol Selanjutnya =====
function updatePaginationBtn(show) {
    if (!el.paginationWrapper) return;
    el.paginationWrapper.style.display = show ? 'flex' : 'none';
}

// ===== Build HTML satu movie card =====
function buildMovieCard(movie) {
    const title       = movie.title.length > 35 ? movie.title.substring(0, 35) + '...' : movie.title;
    const viewsText   = formatViews(movie.views || 0);
    const thumbUrl    = movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title);
    const aspectClass = getAspectRatioClass(movie.aspect_ratio || '16:9');
    const badgeHtml   = movie.category
        ? `<div class="category-badge category-${movie.category}">${getCategoryDisplayName(movie.category)}</div>`
        : '';

    return `
    <div class="movie-card" data-id="${movie.id}">
        <div class="movie-thumbnail-container ${aspectClass}">
            <img
                src="${thumbUrl}"
                alt="${movie.title}"
                class="movie-thumbnail"
                loading="lazy"
                onerror="this.src='https://placehold.co/400x225/1a1a1a/ffffff?text=Thumbnail+Error'"
            >
            ${badgeHtml}
        </div>
        <div class="movie-info">
            <h3 class="movie-title" title="${movie.title}">${title}</h3>
            <div class="movie-meta">
                <span class="movie-views">▶ ${viewsText}</span>
            </div>
        </div>
    </div>`;
}
