import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    videoPlayer: document.getElementById('video-player'),
    videoTitle: document.getElementById('video-title'),
    videoViews: document.getElementById('video-views'),
    videoCategory: document.getElementById('video-category'),
    videoDescription: document.getElementById('video-description'),
    shareBtn: document.getElementById('share-btn'),
    downloadBtn: document.getElementById('download-btn'),
    relatedGrid: document.getElementById('related-grid')
};

// State
let currentMovie = null;
let relatedMovies = [];

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi
async function initializeApp() {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');
    
    if (movieId) {
        await loadMovieDetail(movieId);
        await loadRelatedMovies();
    } else {
        window.location.href = 'index.html';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Share button
    elements.shareBtn.addEventListener('click', handleShare);
    
    // Download button
    elements.downloadBtn.addEventListener('click', handleDownload);
    
    // Update views ketika video diputar
    elements.videoPlayer.addEventListener('play', async () => {
        if (currentMovie) {
            await updateMovieViews(currentMovie.id);
        }
    });
}

// Load movie detail
async function loadMovieDetail(movieId) {
    try {
        const { data: movie, error } = await supabase
            .from('movies')
            .select('*')
            .eq('id', movieId)
            .single();

        if (error) {
            throw error;
        }

        if (movie) {
            currentMovie = movie;
            displayMovieDetail(movie);
        } else {
            window.location.href = 'index.html';
        }

    } catch (error) {
        console.error('Error loading movie detail:', error);
        window.location.href = 'index.html';
    }
}

// Display movie detail
function displayMovieDetail(movie) {
    elements.videoPlayer.src = movie.video_url;
    elements.videoTitle.textContent = movie.title;
    elements.videoViews.textContent = `▶ ${formatViews(movie.views || 0)} penonton`;
    elements.videoCategory.textContent = movie.category?.toUpperCase() || 'LAINNYA';
    elements.videoDescription.textContent = movie.description || 'Tidak ada deskripsi.';
    
    // Set category class untuk badge
    elements.videoCategory.className = 'video-category';
    if (movie.category) {
        elements.videoCategory.classList.add(`category-${movie.category}`);
    }
}

// Load related movies (maksimal 20 video)
async function loadRelatedMovies() {
    try {
        const { data: movies, error } = await supabase
            .from('movies')
            .select('*')
            .neq('id', currentMovie.id)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            throw error;
        }

        relatedMovies = movies || [];
        displayRelatedMovies(relatedMovies);

    } catch (error) {
        console.error('Error loading related movies:', error);
        elements.relatedGrid.innerHTML = `
            <div class="no-movies">
                <p>Gagal memuat video lainnya.</p>
            </div>
        `;
    }
}

// Generate thumbnail URL dengan support Cloudflare R2
function generateThumbnailUrl(videoUrl, movieTitle = "") {
    if (!videoUrl) return 'https://placehold.co/400x225/1a1a1a/ffffff?text=No+Video';
    
    // YouTube thumbnail
    if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
        let videoId;
        
        if (videoUrl.includes("youtube.com/watch?v=")) {
            const urlParams = new URL(videoUrl).searchParams;
            videoId = urlParams.get("v");
        } else if (videoUrl.includes("youtu.be/")) {
            videoId = videoUrl.split("youtu.be/")[1];
            videoId = videoId.split('?')[0];
        }
        
        if (videoId && videoId.length === 11) {
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }
    
    // Google Drive thumbnail
    if (videoUrl.includes("drive.google.com")) {
        let fileId;
        
        if (videoUrl.includes("/file/d/")) {
            const parts = videoUrl.split('/file/d/')[1].split('/');
            fileId = parts[0];
        } else if (videoUrl.includes("id=")) {
            fileId = new URL(videoUrl).searchParams.get("id");
        }
        
        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}=s400`;
        }
    }
    
    // 🔥 CLOUDFLARE R2 SUPPORT
    if (videoUrl.includes("r2.dev") || videoUrl.includes("cloudflarestorage.com")) {
        // Extract file name from URL
        const fileName = videoUrl.split('/').pop();
        const baseName = fileName.split('.')[0] || 'Video';
        
        // Create display name from movie title or filename
        let displayName = movieTitle && movieTitle.trim() !== '' 
            ? movieTitle 
            : baseName.replace(/[-_]/g, ' ');
            
        displayName = displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName;
        
        return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(displayName)}`;
    }
    
    // Default placeholder dengan judul film
    const shortTitle = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
    return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(shortTitle || 'Video')}`;
}

// Display related movies
function displayRelatedMovies(movies) {
    if (!movies || movies.length === 0) {
        elements.relatedGrid.innerHTML = `
            <div class="no-movies">
                <p>Tidak ada video lainnya.</p>
            </div>
        `;
        return;
    }

    elements.relatedGrid.innerHTML = movies.map(movie => {
        const title = movie.title.length > 35 ? movie.title.substring(0, 35) + '...' : movie.title;
        const views = movie.views || 0;
        const viewsText = formatViews(views);
        // Gunakan thumbnail_url dari database jika ada, atau generate otomatis
        const thumbnailUrl = movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title);
        
        return `
        <div class="movie-card" data-id="${movie.id}">
            <div class="movie-thumbnail-container">
                <img 
                    src="${thumbnailUrl}" 
                    alt="${movie.title}"
                    class="movie-thumbnail"
                    loading="lazy"
                    onerror="this.src='https://placehold.co/400x225/1a1a1a/ffffff?text=Thumbnail+Error'"
                >
                ${movie.category ? `<div class="category-badge category-${movie.category}">${movie.category.toUpperCase()}</div>` : ''}
            </div>
            <div class="movie-info">
                <h3 class="movie-title" title="${movie.title}">${title}</h3>
                <div class="movie-meta">
                    <span class="movie-views">️▶ ${viewsText}</span>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // Add click event to related movie cards
    elements.relatedGrid.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const movieId = card.dataset.id;
            window.location.href = `detail.html?id=${movieId}`;
        });
    });
}

// Update movie views
async function updateMovieViews(movieId) {
    try {
        const { data: movie, error } = await supabase
            .from('movies')
            .select('views')
            .eq('id', movieId)
            .single();

        if (error) {
            throw error;
        }

        const newViews = (movie.views || 0) + 1;
        
        await supabase
            .from('movies')
            .update({ views: newViews })
            .eq('id', movieId);

        // Update tampilan views
        elements.videoViews.textContent = `▶ ${formatViews(newViews)} penonton`;

    } catch (error) {
        console.error('Error updating views:', error);
    }
}

// Handle share
function handleShare() {
    if (navigator.share) {
        navigator.share({
            title: currentMovie.title,
            text: currentMovie.description,
            url: window.location.href
        }).catch(console.error);
    } else {
        // Fallback untuk browser yang tidak support Web Share API
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Link berhasil disalin ke clipboard!');
        }).catch(() => {
            // Fallback jika clipboard tidak tersedia
            prompt('Salin link berikut:', window.location.href);
        });
    }
}

// Handle download
function handleDownload() {
    if (currentMovie.download_url) {
        window.open(currentMovie.download_url, '_blank');
    } else {
        alert('Link download tidak tersedia untuk film ini.');
    }
}

// Format jumlah penonton
function formatViews(views) {
    if (views >= 1000000) {
        return `${(views / 1000000).toFixed(1)}JT`;
    } else if (views >= 1000) {
        return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
}