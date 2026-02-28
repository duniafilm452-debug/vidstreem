import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// ===== Konfigurasi Supabase =====
const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== Elemen DOM =====
const el = {
    player:      document.getElementById('video-player'),
    title:       document.getElementById('video-title'),
    views:       document.getElementById('video-views'),
    category:    document.getElementById('video-category'),
    description: document.getElementById('video-description'),
    shareBtn:    document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    relatedGrid: document.getElementById('related-grid'),
};

// ===== State =====
let currentMovie = null;

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
    const params  = new URLSearchParams(window.location.search);
    const movieId = params.get('id');

    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }

    await loadMovieDetail(movieId);
    await loadRelatedMovies();
    setupEventListeners();
});

// ===== Event Listeners =====
function setupEventListeners() {
    el.shareBtn?.addEventListener('click', handleShare);
    el.downloadBtn?.addEventListener('click', handleDownload);

    // Update views satu kali ketika video mulai diputar
    el.player?.addEventListener('play', () => {
        if (currentMovie) updateMovieViews(currentMovie.id);
    }, { once: true });
}

// ===== Load Movie Detail =====
async function loadMovieDetail(movieId) {
    try {
        const { data: movie, error } = await supabase
            .from('movies')
            .select('*')
            .eq('id', movieId)
            .single();

        if (error || !movie) throw error || new Error('Not found');

        currentMovie = movie;
        renderMovieDetail(movie);

    } catch (err) {
        console.error('Error loading movie detail:', err);
        window.location.href = 'index.html';
    }
}

// ===== Render Movie Detail =====
function renderMovieDetail(movie) {
    document.title = `${movie.title} - Vid18+`;

    el.player.src        = movie.video_url || '';
    el.title.textContent = movie.title     || '—';
    el.views.textContent = `▶ ${formatViews(movie.views || 0)} penonton`;
    el.description.textContent = movie.description || 'Tidak ada deskripsi.';

    // Category badge
    const catName = getCategoryDisplayName(movie.category);
    el.category.textContent = catName;
    el.category.className   = 'video-category';
    if (movie.category) el.category.classList.add(`category-${movie.category}`);
}

// ===== Load Related Movies =====
async function loadRelatedMovies() {
    try {
        const { data, error } = await supabase
            .from('movies')
            .select('*')
            .neq('id', currentMovie.id)
            .limit(50);

        if (error) throw error;

        const shuffled = shuffleArray(data || []).slice(0, 20);
        renderRelatedMovies(shuffled);

    } catch (err) {
        console.error('Error loading related movies:', err);
        el.relatedGrid.innerHTML = `<div class="no-movies"><p>Gagal memuat video lainnya.</p></div>`;
    }
}

// ===== Render Related Movies =====
function renderRelatedMovies(movies) {
    if (!movies?.length) {
        el.relatedGrid.innerHTML = `<div class="no-movies"><p>Tidak ada video lainnya.</p></div>`;
        return;
    }

    el.relatedGrid.innerHTML = movies.map(movie => {
        const title      = movie.title?.length > 35 ? movie.title.substring(0, 35) + '...' : (movie.title || '');
        const thumbUrl   = movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title);
        const ratio      = getAspectRatioClass(movie.aspect_ratio);
        const badgeHtml  = movie.category
            ? `<div class="category-badge category-${movie.category}">${getCategoryDisplayName(movie.category)}</div>`
            : '';

        return `
        <div class="movie-card" data-id="${movie.id}">
            <div class="movie-thumbnail-container ${ratio}">
                <img
                    src="${thumbUrl}"
                    alt="${movie.title || ''}"
                    class="movie-thumbnail"
                    loading="lazy"
                    onerror="this.src='https://placehold.co/400x225/1a1a1a/ffffff?text=Error'"
                >
                ${badgeHtml}
            </div>
            <div class="movie-info">
                <h3 class="movie-title" title="${movie.title || ''}">${title}</h3>
                <div class="movie-meta">
                    <span class="movie-views">▶ ${formatViews(movie.views || 0)}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    el.relatedGrid.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `detail.html?id=${card.dataset.id}`;
        });
    });
}

// ===== Update Views =====
async function updateMovieViews(movieId) {
    try {
        const { data: row, error } = await supabase
            .from('movies')
            .select('views')
            .eq('id', movieId)
            .single();

        if (error) throw error;

        const newViews = (row.views || 0) + 1;

        await supabase
            .from('movies')
            .update({ views: newViews })
            .eq('id', movieId);

        if (el.views) el.views.textContent = `▶ ${formatViews(newViews)} penonton`;

    } catch (err) {
        console.error('Error updating views:', err);
    }
}

// ===== Handle Share =====
function handleShare() {
    if (!currentMovie) return;

    if (navigator.share) {
        navigator.share({
            title: currentMovie.title,
            text:  currentMovie.description || '',
            url:   window.location.href,
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(window.location.href)
            .then(() => alert('Link berhasil disalin!'))
            .catch(() => prompt('Salin link berikut:', window.location.href));
    }
}

// ===== Handle Download =====
function handleDownload() {
    if (currentMovie?.download_url) {
        window.open(currentMovie.download_url, '_blank', 'noopener,noreferrer');
    } else {
        alert('Link download tidak tersedia untuk video ini.');
    }
}

// ===== Helpers =====

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function formatViews(v) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}JT`;
    if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return String(v);
}

function getCategoryDisplayName(cat) {
    const map = { colmek: 'COLMEK', berdua: 'BERDUA', bergilir: 'BERGILIR', lainnya: 'LAINNYA' };
    return map[cat] || (cat ? cat.toUpperCase() : 'LAINNYA');
}

function getAspectRatioClass(ratio) {
    const map = { '16:9': 'aspect-16-9', '9:16': 'aspect-9-16', '3:4': 'aspect-3-4', '4:3': 'aspect-4-3' };
    return map[ratio] || 'aspect-16-9';
}

function generateThumbnailUrl(videoUrl, movieTitle = '') {
    if (!videoUrl) return 'https://placehold.co/400x225/1a1a1a/ffffff?text=No+Video';

    // YouTube
    if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
        let id;
        if (videoUrl.includes('watch?v=')) id = new URL(videoUrl).searchParams.get('v');
        else if (videoUrl.includes('youtu.be/')) id = videoUrl.split('youtu.be/')[1].split('?')[0];
        if (id && id.length === 11) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    }

    // Google Drive
    if (videoUrl.includes('drive.google.com')) {
        let fileId;
        if (videoUrl.includes('/file/d/'))    fileId = videoUrl.split('/file/d/')[1].split('/')[0];
        else if (videoUrl.includes('id='))    fileId = new URL(videoUrl).searchParams.get('id');
        if (fileId) return `https://lh3.googleusercontent.com/d/${fileId}=s400`;
    }

    // Cloudflare R2
    if (videoUrl.includes('r2.dev') || videoUrl.includes('cloudflarestorage.com')) {
        let label = movieTitle?.trim() || videoUrl.split('/').pop().split('.')[0].replace(/[-_]/g, ' ') || 'Video';
        if (label.length > 20) label = label.substring(0, 20) + '...';
        return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(label)}`;
    }

    // Vimeo
    if (videoUrl.includes('vimeo.com')) {
        const id = videoUrl.split('vimeo.com/')[1]?.split('/')[0]?.split('?')[0];
        if (id && /^\d+$/.test(id)) return `https://vumbnail.com/${id}.jpg`;
    }

    // Default
    const s = movieTitle?.length > 20 ? movieTitle.substring(0, 20) + '...' : (movieTitle || 'Video');
    return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(s)}`;
}
