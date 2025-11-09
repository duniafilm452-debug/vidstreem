import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    moviesGrid: document.getElementById('movies-grid'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    categoryBtns: document.querySelectorAll('.category-btn'),
    tabBtns: document.querySelectorAll('.tab-btn')
};

// State
let allMovies = [];
let currentCategory = 'all';
let currentTab = 'recommended';
let currentSearch = '';

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi
async function initializeApp() {
    await loadMovies();
}

// Setup event listeners
function setupEventListeners() {
    // Search functionality
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    // Category buttons
    elements.categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            elements.categoryBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            currentCategory = btn.dataset.category;
            filterMovies();
        });
    });

    // Tab buttons
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            elements.tabBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            currentTab = btn.dataset.tab;
            filterMovies();
        });
    });
}

// Load movies dari Supabase
async function loadMovies() {
    try {
        const { data: movies, error } = await supabase
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        allMovies = movies || [];
        filterMovies();

    } catch (error) {
        console.error('Error loading movies:', error);
        elements.moviesGrid.innerHTML = `
            <div class="no-movies">
                <p>Gagal memuat film. Silakan refresh halaman.</p>
            </div>
        `;
    }
}

// Handle search
function handleSearch() {
    currentSearch = elements.searchInput.value.trim().toLowerCase();
    filterMovies();
}

// Fungsi untuk mengacak array (Fisher-Yates shuffle)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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
    
    // Vimeo thumbnail
    if (videoUrl.includes("vimeo.com")) {
        const videoId = videoUrl.split('vimeo.com/')[1]?.split('/')[0]?.split('?')[0];
        if (videoId && /^\d+$/.test(videoId)) {
            return `https://vumbnail.com/${videoId}.jpg`;
        }
    }
    
    // Default placeholder dengan judul film
    const shortTitle = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
    return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(shortTitle || 'Video')}`;
}

// Filter movies berdasarkan category, tab, dan search
function filterMovies() {
    let filteredMovies = [...allMovies];

    // Filter berdasarkan kategori (menggunakan kolom category dari database)
    if (currentCategory !== 'all') {
        filteredMovies = filteredMovies.filter(movie => {
            const movieCategory = movie.category?.toLowerCase() || 'lainnya';
            return movieCategory === currentCategory;
        });
    }

    // Filter berdasarkan tab dengan logika berbeda
    switch (currentTab) {
        case 'latest':
            // Untuk tab TERBARU: selalu urutkan berdasarkan created_at (yang paling baru di atas)
            filteredMovies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
            
        case 'popular':
            // Untuk tab POPULER: urutkan berdasarkan views
            filteredMovies.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
            
        case 'recommended':
        default:
            // Untuk tab REKOMENDASI: acak urutan film setiap kali di-refresh
            filteredMovies = shuffleArray(filteredMovies);
            break;
    }

    // Filter berdasarkan search
    if (currentSearch) {
        filteredMovies = filteredMovies.filter(movie => 
            movie.title?.toLowerCase().includes(currentSearch) ||
            movie.description?.toLowerCase().includes(currentSearch)
        );
    }

    displayMovies(filteredMovies);
}

// Display movies dengan thumbnail aspect ratio 9:16 dan info penonton
function displayMovies(movies) {
    if (!movies || movies.length === 0) {
        elements.moviesGrid.innerHTML = `
            <div class="no-movies">
                <p>Tidak ada film yang ditemukan.</p>
            </div>
        `;
        return;
    }

    elements.moviesGrid.innerHTML = movies.map(movie => {
        // Potong judul jika terlalu panjang (max 35 karakter)
        const title = movie.title.length > 35 ? movie.title.substring(0, 35) + '...' : movie.title;
        
        // Format jumlah penonton
        const views = movie.views || 0;
        const viewsText = views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views.toString();
        
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

    // Add click event to movie cards
    elements.moviesGrid.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', () => {
            const movieId = card.dataset.id;
            window.location.href = `detail.html?id=${movieId}`;
        });
    });
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