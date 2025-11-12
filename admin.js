import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let allMovies = [];
let selectedMovies = new Set();
let videoElement = null;
let thumbnailCanvas = null;
let currentVideoUrl = '';

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
  // Check login status - HANYA dijalankan jika admin panel ada
  const adminPanel = document.getElementById('admin-panel');
  if (!adminPanel) return;
  
  if (localStorage.getItem('adminLoggedIn') !== 'true') {
    // Redirect ke halaman login jika belum login
    window.location.href = 'admin.html';
    return;
  }

  await initializeApp();
  setupEventListeners();
});

// Fungsi inisialisasi
async function initializeApp() {
  showLoading();
  await loadMovies();
  await loadStats();
  await loadRecentMovies();
  hideLoading();
  updateLastUpdated();
}

// Setup event listeners
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      switchTab(tabName);
    });
  });

  // Form submission
  const movieForm = document.getElementById('movie-form');
  if (movieForm) {
    movieForm.addEventListener('submit', handleAddMovie);
  }

  // Search functionality
  const searchBtn = document.getElementById('admin-search-btn');
  const searchInput = document.getElementById('admin-search');
  
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }

  // Export data
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  // Bulk delete
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  if (bulkDeleteBtn) {
    bulkDeleteBtn.addEventListener('click', handleBulkDelete);
  }

  // Category filter
  const categoryFilter = document.getElementById('category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', handleCategoryFilter);
  }

  // Real-time form preview
  const titleInput = document.getElementById('movie-title');
  const videoUrlInput = document.getElementById('movie-video-url');
  const aspectRatioInput = document.getElementById('movie-aspect-ratio');
  
  if (titleInput && videoUrlInput && aspectRatioInput) {
    titleInput.addEventListener('input', updateFormPreview);
    videoUrlInput.addEventListener('input', updateFormPreview);
    aspectRatioInput.addEventListener('change', updateFormPreview);
  }

  // Thumbnail picker events
  setupThumbnailPicker();
}

// Setup thumbnail picker functionality
function setupThumbnailPicker() {
  const generateThumbnailBtn = document.getElementById('generate-thumbnail-btn');
  const thumbnailModal = document.getElementById('thumbnail-modal');
  const closeModal = document.getElementById('close-thumbnail-modal');
  const confirmThumbnail = document.getElementById('confirm-thumbnail');
  const cancelThumbnail = document.getElementById('cancel-thumbnail');
  const seekBar = document.getElementById('thumbnail-seek-bar');
  const aspectRatioSelect = document.getElementById('thumbnail-aspect-ratio');
  
  if (generateThumbnailBtn) {
    generateThumbnailBtn.addEventListener('click', openThumbnailPicker);
  }
  
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      thumbnailModal.style.display = 'none';
      cleanupVideoElement();
    });
  }
  
  if (confirmThumbnail) {
    confirmThumbnail.addEventListener('click', confirmSelectedThumbnail);
  }
  
  if (cancelThumbnail) {
    cancelThumbnail.addEventListener('click', () => {
      thumbnailModal.style.display = 'none';
      cleanupVideoElement();
    });
  }

  if (seekBar) {
    seekBar.addEventListener('input', updateThumbnailPreview);
  }

  if (aspectRatioSelect) {
    aspectRatioSelect.addEventListener('change', updateThumbnailPreview);
  }
}

// Tab navigation function
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Load specific data if needed
  if (tabName === 'manage-movies') {
    loadMoviesTable();
  }
}

// Open thumbnail picker modal
async function openThumbnailPicker() {
  const videoUrl = document.getElementById('movie-video-url').value.trim();
  const thumbnailModal = document.getElementById('thumbnail-modal');
  const videoContainer = document.getElementById('thumbnail-video-container');
  const seekBar = document.getElementById('thumbnail-seek-bar');
  const currentTimeDisplay = document.getElementById('current-time');
  const aspectRatioSelect = document.getElementById('thumbnail-aspect-ratio');
  
  if (!videoUrl) {
    showNotification('Masukkan URL video terlebih dahulu', 'error');
    return;
  }

  if (!isVideoUrlSupported(videoUrl)) {
    showNotification('URL video tidak didukung untuk pemilihan thumbnail', 'error');
    return;
  }

  showLoading();
  
  try {
    // Setup video element
    videoContainer.innerHTML = '';
    videoElement = document.createElement('video');
    videoElement.id = 'thumbnail-video';
    videoElement.crossOrigin = 'anonymous';
    videoElement.preload = 'metadata';
    
    // Setup canvas untuk thumbnail
    thumbnailCanvas = document.createElement('canvas');
    
    videoElement.addEventListener('loadedmetadata', () => {
      const duration = Math.floor(videoElement.duration);
      seekBar.max = duration;
      seekBar.value = Math.min(30, Math.floor(duration * 0.1)); // Default ke 10% atau 30 detik
      updateThumbnailPreview();
      hideLoading();
    });
    
    videoElement.addEventListener('error', () => {
      hideLoading();
      showNotification('Gagal memuat video. Pastikan URL video valid dan dapat diakses.', 'error');
    });
    
    videoElement.src = videoUrl;
    currentVideoUrl = videoUrl;
    videoContainer.appendChild(videoElement);
    
    // Set aspect ratio default dari form
    const formAspectRatio = document.getElementById('movie-aspect-ratio').value;
    if (aspectRatioSelect) {
      aspectRatioSelect.value = formAspectRatio;
    }
    
    // Show modal
    thumbnailModal.style.display = 'block';
    
  } catch (error) {
    console.error('Error opening thumbnail picker:', error);
    hideLoading();
    showNotification('Gagal membuka pemilih thumbnail', 'error');
  }
}

// Update thumbnail preview based on seek bar position and aspect ratio
function updateThumbnailPreview() {
  const seekBar = document.getElementById('thumbnail-seek-bar');
  const currentTimeDisplay = document.getElementById('current-time');
  const thumbnailPreview = document.getElementById('thumbnail-preview');
  const aspectRatioSelect = document.getElementById('thumbnail-aspect-ratio');
  
  if (!videoElement || !thumbnailCanvas || !seekBar) return;
  
  const time = parseInt(seekBar.value);
  const duration = videoElement.duration;
  const aspectRatio = aspectRatioSelect ? aspectRatioSelect.value : '16:9';
  
  // Update time display
  if (currentTimeDisplay) {
    currentTimeDisplay.textContent = formatTime(time) + ' / ' + formatTime(duration);
  }
  
  // Set canvas size berdasarkan aspect ratio
  const canvasSize = getCanvasSizeForAspectRatio(aspectRatio);
  thumbnailCanvas.width = canvasSize.width;
  thumbnailCanvas.height = canvasSize.height;
  
  // Capture frame
  try {
    videoElement.currentTime = time;
    
    videoElement.onseeked = () => {
      const ctx = thumbnailCanvas.getContext('2d');
      
      // Clear canvas
      ctx.clearRect(0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
      
      // Draw video frame ke canvas
      ctx.drawImage(videoElement, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
      
      // Convert canvas to data URL for preview
      const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8);
      
      // Update preview dengan aspect ratio yang sesuai
      const previewClass = getAspectRatioClass(aspectRatio);
      thumbnailPreview.innerHTML = `
        <div class="thumbnail-preview-container ${previewClass}">
          <img src="${thumbnailDataUrl}" alt="Thumbnail Preview" style="width: 100%; height: 100%; object-fit: cover;">
          <div class="thumbnail-time-overlay">
            ${formatTime(time)}
          </div>
          <div class="thumbnail-aspect-info">
            ${aspectRatio}
          </div>
        </div>
      `;
    };
  } catch (error) {
    console.error('Error capturing thumbnail:', error);
  }
}

// Get canvas size berdasarkan aspect ratio
function getCanvasSizeForAspectRatio(aspectRatio) {
  const sizes = {
    '16:9': { width: 400, height: 225 },
    '9:16': { width: 225, height: 400 },
    '3:4': { width: 300, height: 400 },
    '4:3': { width: 400, height: 300 }
  };
  return sizes[aspectRatio] || sizes['16:9'];
}

// Confirm selected thumbnail
function confirmSelectedThumbnail() {
  const thumbnailModal = document.getElementById('thumbnail-modal');
  const thumbnailUrlInput = document.getElementById('movie-thumbnail-url');
  const aspectRatioSelect = document.getElementById('thumbnail-aspect-ratio');
  
  if (!thumbnailCanvas) return;
  
  try {
    // Convert canvas to data URL
    const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8);
    
    // Set thumbnail URL input
    thumbnailUrlInput.value = thumbnailDataUrl;
    
    // Update aspect ratio di form utama jika berubah
    if (aspectRatioSelect) {
      const selectedAspectRatio = aspectRatioSelect.value;
      document.getElementById('movie-aspect-ratio').value = selectedAspectRatio;
    }
    
    // Update form preview
    updateFormPreview();
    
    // Close modal
    thumbnailModal.style.display = 'none';
    cleanupVideoElement();
    
    showNotification('Thumbnail berhasil dipilih!', 'success');
    
  } catch (error) {
    console.error('Error confirming thumbnail:', error);
    showNotification('Gagal menyimpan thumbnail', 'error');
  }
}

// Cleanup video element
function cleanupVideoElement() {
  if (videoElement) {
    videoElement.pause();
    videoElement.src = '';
    videoElement = null;
  }
  thumbnailCanvas = null;
  currentVideoUrl = '';
}

// Format time (seconds to MM:SS)
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Check if video URL is supported for thumbnail picking
function isVideoUrlSupported(videoUrl) {
  const supportedPatterns = [
    /youtube\.com|youtu\.be/,
    /drive\.google\.com/,
    /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)(\?.*)?$/i,
    /r2\.dev|cloudflarestorage\.com/
  ];
  
  return supportedPatterns.some(pattern => pattern.test(videoUrl));
}

// Load all movies
async function loadMovies() {
  try {
    const { data: movies, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allMovies = movies || [];
    
    // Update dashboard counts
    updateDashboardCounts();
    
  } catch (error) {
    console.error('Error loading movies:', error);
    showNotification('Gagal memuat data film', 'error');
  }
}

// Update dashboard counts
function updateDashboardCounts() {
  const totalMovies = allMovies.length;
  const totalViews = allMovies.reduce((sum, movie) => sum + (movie.views || 0), 0);
  
  const totalMoviesEl = document.getElementById('total-movies-count');
  const totalViewsEl = document.getElementById('total-views-count');
  
  if (totalMoviesEl) totalMoviesEl.textContent = totalMovies;
  if (totalViewsEl) totalViewsEl.textContent = formatViews(totalViews);
}

// Load statistics
async function loadStats() {
  const statsContainer = document.getElementById('stats-container');
  if (!statsContainer) return;

  try {
    // Total movies
    const { count: totalMovies } = await supabase
      .from('movies')
      .select('*', { count: 'exact', head: true });

    // Total views
    const { data: viewsData } = await supabase
      .from('movies')
      .select('views');

    const totalViews = viewsData?.reduce((sum, movie) => sum + (movie.views || 0), 0) || 0;

    // Movies by category
    const { data: categoryData } = await supabase
      .from('movies')
      .select('category');

    const categoryStats = {};
    categoryData?.forEach(movie => {
      categoryStats[movie.category] = (categoryStats[movie.category] || 0) + 1;
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: recentMovies } = await supabase
      .from('movies')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    displayStats({
      totalMovies: totalMovies || 0,
      totalViews,
      categoryStats,
      recentMovies: recentMovies?.length || 0
    });

  } catch (error) {
    console.error('Error loading stats:', error);
    statsContainer.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        Gagal memuat statistik
      </div>
    `;
  }
}

// Display statistics
function displayStats(stats) {
  const statsContainer = document.getElementById('stats-container');
  if (!statsContainer) return;

  statsContainer.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">🎬</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalMovies}</div>
          <div class="stat-label">Total Film</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👁️</div>
        <div class="stat-content">
          <div class="stat-value">${formatViews(stats.totalViews)}</div>
          <div class="stat-label">Total Penonton</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-value">${stats.recentMovies}</div>
          <div class="stat-label">Film Baru (7 hari)</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-value">${Object.keys(stats.categoryStats).length}</div>
          <div class="stat-label">Kategori</div>
        </div>
      </div>
    </div>
    
    ${Object.keys(stats.categoryStats).length > 0 ? `
    <div class="category-stats">
      <h3>Distribusi Kategori</h3>
      <div class="category-bars">
        ${Object.entries(stats.categoryStats).map(([category, count]) => `
          <div class="category-bar">
            <div class="category-bar-label">
              <span class="category-dot category-${category}"></span>
              ${getCategoryDisplayName(category)}
            </div>
            <div class="category-bar-count">${count}</div>
            <div class="category-bar-progress">
              <div class="category-bar-fill category-${category}" 
                   style="width: ${(count / stats.totalMovies) * 100}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
  `;
}

// Get category display name
function getCategoryDisplayName(category) {
  const categoryMap = {
    'colmek': 'COLMEX',
    'berdua': 'BERDUA',
    'bergilir': 'BERGILIR', 
    'lainnya': 'LAINNYA'
  };
  return categoryMap[category] || category.toUpperCase();
}

// Load recent movies
async function loadRecentMovies() {
  const container = document.getElementById('recent-movies-container');
  if (!container) return;

  try {
    const { data: movies, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) throw error;

    displayRecentMovies(movies || []);

  } catch (error) {
    console.error('Error loading recent movies:', error);
    container.innerHTML = `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        Gagal memuat film terbaru
      </div>
    `;
  }
}

// Display recent movies
function displayRecentMovies(movies) {
  const container = document.getElementById('recent-movies-container');
  if (!container) return;

  if (!movies || movies.length === 0) {
    container.innerHTML = `
      <div class="no-data">
        <span class="no-data-icon">📭</span>
        <p>Belum ada film</p>
      </div>
    `;
    return;
  }

  container.innerHTML = movies.map(movie => {
    const thumbnailUrl = movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title);
    const viewsText = formatViews(movie.views || 0);
    const createdDate = new Date(movie.created_at).toLocaleDateString('id-ID');

    return `
      <div class="recent-movie-card">
        <img src="${thumbnailUrl}" alt="${movie.title}" class="recent-movie-thumbnail"
             onerror="this.src='https://placehold.co/80x60/1a1a1a/ffffff?text=No+Img'">
        <div class="recent-movie-info">
          <div class="recent-movie-title">${movie.title}</div>
          <div class="recent-movie-meta">
            <span>▶ ${viewsText}</span>
            <span>${createdDate}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Handle add movie
async function handleAddMovie(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('.submit-btn');
  const title = document.getElementById('movie-title').value.trim();
  const videoUrl = document.getElementById('movie-video-url').value.trim();

  // Validasi hanya field wajib
  if (!title || !videoUrl) {
    showNotification('Judul film dan URL video wajib diisi', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Menyimpan...';

  try {
    // Gunakan custom thumbnail URL jika ada, atau generate otomatis
    const customThumbnailUrl = document.getElementById('movie-thumbnail-url').value.trim();
    const thumbnailUrl = customThumbnailUrl || generateThumbnailUrl(videoUrl, title);

    const movieData = {
      title: title,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      aspect_ratio: document.getElementById('movie-aspect-ratio').value || '16:9',
      description: document.getElementById('movie-description').value.trim() || null,
      category: document.getElementById('movie-category').value || 'lainnya',
      views: 0,
      download_url: document.getElementById('movie-download-url').value.trim() || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('movies')
      .insert([movieData])
      .select();

    if (error) throw error;

    showNotification('Film berhasil ditambahkan!', 'success');
    
    // Reset form
    document.getElementById('movie-form').reset();
    document.getElementById('form-preview').innerHTML = `
      <div class="preview-placeholder">
        <span class="preview-icon">👆</span>
        <p>Isi form untuk melihat preview</p>
      </div>
    `;

    // Reload data
    await loadMovies();
    await loadStats();
    await loadRecentMovies();

    // Switch to dashboard tab
    switchTab('dashboard');

  } catch (error) {
    console.error('Error adding movie:', error);
    showNotification('Gagal menambahkan film: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">💾</span> Simpan Film';
  }
}

// Update form preview
function updateFormPreview() {
  const title = document.getElementById('movie-title').value;
  const videoUrl = document.getElementById('movie-video-url').value;
  const customThumbnailUrl = document.getElementById('movie-thumbnail-url').value;
  const aspectRatio = document.getElementById('movie-aspect-ratio').value;
  const preview = document.getElementById('form-preview');

  if (!title && !videoUrl) {
    preview.innerHTML = `
      <div class="preview-placeholder">
        <span class="preview-icon">👆</span>
        <p>Isi form untuk melihat preview</p>
      </div>
    `;
    return;
  }

  // Prioritize custom thumbnail URL, then generate from video
  const thumbnailUrl = customThumbnailUrl || generateThumbnailUrl(videoUrl, title);
  
  // Calculate aspect ratio class
  const aspectRatioClass = getAspectRatioClass(aspectRatio);
  
  preview.innerHTML = `
    <div class="movie-preview">
      <div class="preview-thumbnail ${aspectRatioClass}">
        <img src="${thumbnailUrl}" alt="Preview" onerror="this.src='https://placehold.co/400x225/1a1a1a/ffffff?text=Preview'">
      </div>
      <div class="preview-info">
        <h4 class="preview-title">${title || 'Judul Film'}</h4>
        <p class="preview-url">${videoUrl || 'URL Video'}</p>
        <div class="preview-meta">
          <span class="preview-views">▶ 0 penonton</span>
          <span class="preview-category">${getCategoryDisplayName(document.getElementById('movie-category').value) || 'Kategori'}</span>
          <span class="preview-aspect-ratio">${aspectRatio}</span>
        </div>
      </div>
    </div>
  `;
}

// Get aspect ratio class
function getAspectRatioClass(aspectRatio) {
  const ratioMap = {
    '16:9': 'aspect-16-9',
    '9:16': 'aspect-9-16',
    '3:4': 'aspect-3-4',
    '4:3': 'aspect-4-3'
  };
  return ratioMap[aspectRatio] || 'aspect-16-9';
}

// Load movies table for management tab
async function loadMoviesTable() {
  const tableBody = document.getElementById('movies-table-body');
  if (!tableBody) return;

  try {
    let query = supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply category filter if selected
    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter && categoryFilter.value !== 'all') {
      query = query.eq('category', categoryFilter.value);
    }

    // Apply search filter if exists
    const searchInput = document.getElementById('admin-search');
    if (searchInput && searchInput.value.trim() !== '') {
      const searchTerm = searchInput.value.trim().toLowerCase();
      query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }

    const { data: movies, error } = await query;

    if (error) throw error;

    displayMoviesTable(movies || []);

  } catch (error) {
    console.error('Error loading movies table:', error);
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="loading error">
          <div class="error-message">
            <span class="error-icon">⚠️</span>
            Gagal memuat data film
          </div>
        </td>
      </tr>
    `;
  }
}

// Display movies in table
function displayMoviesTable(movies) {
  const tableBody = document.getElementById('movies-table-body');
  const totalCountEl = document.getElementById('total-count');
  const displayCountEl = document.getElementById('display-count');
  const totalMoviesEl = document.getElementById('total-movies');
  const totalViewsEl = document.getElementById('total-views');

  if (!tableBody) return;

  // Update counts
  const totalViews = movies.reduce((sum, movie) => sum + (movie.views || 0), 0);
  
  if (totalCountEl) totalCountEl.textContent = movies.length;
  if (displayCountEl) displayCountEl.textContent = movies.length;
  if (totalMoviesEl) totalMoviesEl.textContent = movies.length;
  if (totalViewsEl) totalViewsEl.textContent = formatViews(totalViews);

  if (!movies || movies.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="loading">
          <div class="no-data">
            <span class="no-data-icon">📭</span>
            <p>Tidak ada film yang ditemukan</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = movies.map(movie => {
    const thumbnailUrl = movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title);
    const createdDate = new Date(movie.created_at).toLocaleDateString('id-ID');
    const isSelected = selectedMovies.has(movie.id);
    const aspectRatioClass = getAspectRatioClass(movie.aspect_ratio || '16:9');
    
    return `
    <tr class="${isSelected ? 'selected' : ''}">
      <td class="checkbox-cell">
        <input type="checkbox" class="movie-checkbox" value="${movie.id}" 
               ${isSelected ? 'checked' : ''} onchange="toggleMovieSelection(${movie.id})">
      </td>
      <td class="thumbnail-cell">
        <img src="${thumbnailUrl}" alt="${movie.title}" 
             class="table-thumbnail ${aspectRatioClass}"
             onerror="this.src='https://placehold.co/60x40/1a1a1a/ffffff?text=No+Img'">
      </td>
      <td class="title-cell">
        <div class="movie-title">${movie.title}</div>
        ${movie.description ? `<div class="movie-desc">${movie.description}</div>` : ''}
      </td>
      <td class="category-cell">
        <span class="category-badge category-${movie.category}">${getCategoryDisplayName(movie.category)}</span>
      </td>
      <td class="aspect-ratio-cell">
        <span class="aspect-ratio-badge">${movie.aspect_ratio || '16:9'}</span>
      </td>
      <td class="views-cell">
        <div class="views-count">${formatViews(movie.views || 0)}</div>
      </td>
      <td class="date-cell">
        <div class="date-created">${createdDate}</div>
      </td>
      <td class="actions-cell">
        <div class="action-buttons">
          <button class="edit-btn" onclick="editMovie(${movie.id})" title="Edit film">
            <span class="btn-icon">✏️</span> Edit
          </button>
          <button class="delete-btn" onclick="deleteMovie(${movie.id})" title="Hapus film">
            <span class="btn-icon">🗑️</span> Hapus
          </button>
        </div>
      </td>
    </tr>
    `;
  }).join('');

  updateBulkActions();
}

// Toggle movie selection for bulk operations
window.toggleMovieSelection = function(movieId) {
  if (selectedMovies.has(movieId)) {
    selectedMovies.delete(movieId);
  } else {
    selectedMovies.add(movieId);
  }
  updateBulkActions();
};

// Select all movies
window.selectAllMovies = function(selectAll) {
  const checkboxes = document.querySelectorAll('.movie-checkbox');
  selectedMovies.clear();
  
  if (selectAll) {
    const currentMovies = getCurrentTableMovies();
    currentMovies.forEach(movie => selectedMovies.add(movie.id));
    checkboxes.forEach(checkbox => checkbox.checked = true);
  } else {
    checkboxes.forEach(checkbox => checkbox.checked = false);
  }
  
  updateBulkActions();
};

// Get current movies displayed in table
function getCurrentTableMovies() {
  const categoryFilter = document.getElementById('category-filter');
  const searchTerm = document.getElementById('admin-search')?.value.toLowerCase() || '';
  
  let filteredMovies = [...allMovies];
  
  // Apply category filter
  if (categoryFilter && categoryFilter.value !== 'all') {
    filteredMovies = filteredMovies.filter(movie => movie.category === categoryFilter.value);
  }
  
  // Apply search filter
  if (searchTerm) {
    filteredMovies = filteredMovies.filter(movie => 
      movie.title?.toLowerCase().includes(searchTerm) ||
      movie.description?.toLowerCase().includes(searchTerm)
    );
  }
  
  return filteredMovies;
}

// Update bulk actions UI
function updateBulkActions() {
  const selectedCount = selectedMovies.size;
  const bulkActions = document.getElementById('bulk-actions');
  const selectedCountEl = document.getElementById('selected-count');
  
  if (bulkActions && selectedCountEl) {
    if (selectedCount > 0) {
      bulkActions.style.display = 'flex';
      selectedCountEl.textContent = `${selectedCount} film terpilih`;
    } else {
      bulkActions.style.display = 'none';
    }
  }
}

// Handle bulk delete
async function handleBulkDelete() {
  if (selectedMovies.size === 0) {
    showNotification('Pilih film yang ingin dihapus', 'warning');
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedMovies.size} film?`)) {
    return;
  }

  showLoading();
  try {
    const { error } = await supabase
      .from('movies')
      .delete()
      .in('id', Array.from(selectedMovies));

    if (error) {
      throw error;
    }

    showNotification(`${selectedMovies.size} film berhasil dihapus!`, 'success');
    selectedMovies.clear();
    
    // Reload all data
    await loadMovies();
    await loadStats();
    await loadRecentMovies();
    await loadMoviesTable();
    
  } catch (error) {
    console.error('Error bulk deleting movies:', error);
    showNotification('Gagal menghapus film: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
}

// Edit movie
window.editMovie = async function(movieId) {
  const movie = allMovies.find(m => m.id === movieId);
  if (movie) {
    // Switch to add movie tab and fill form
    switchTab('add-movie');
    
    // Fill form with movie data
    document.getElementById('movie-title').value = movie.title;
    document.getElementById('movie-video-url').value = movie.video_url;
    document.getElementById('movie-description').value = movie.description || '';
    document.getElementById('movie-category').value = movie.category;
    document.getElementById('movie-download-url').value = movie.download_url || '';
    document.getElementById('movie-thumbnail-url').value = movie.thumbnail_url || '';
    document.getElementById('movie-aspect-ratio').value = movie.aspect_ratio || '16:9';
    
    // Update form title and button
    document.querySelector('#add-movie-tab .section-header h2').textContent = '✏️ Edit Film';
    const submitBtn = document.querySelector('#add-movie-tab .submit-btn');
    submitBtn.innerHTML = '<span class="btn-icon">💾</span> Update Film';
    submitBtn.dataset.editId = movieId;
    
    // Update form submission untuk edit mode
    const form = document.getElementById('movie-form');
    const originalHandler = form.onsubmit;
    
    form.onsubmit = async (e) => {
      await handleEditMovie(e, movieId);
      // Restore original handler after edit
      form.onsubmit = originalHandler;
    };
    
    // Update preview
    updateFormPreview();
    
    showNotification(`Mengedit film: ${movie.title}`, 'info');
  }
};

// Handle edit movie
async function handleEditMovie(e, movieId) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('.submit-btn');
  const title = document.getElementById('movie-title').value.trim();
  const videoUrl = document.getElementById('movie-video-url').value.trim();

  // Validasi hanya field wajib
  if (!title || !videoUrl) {
    showNotification('Judul film dan URL video wajib diisi', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Updating...';

  try {
    // Gunakan custom thumbnail URL jika ada, atau generate otomatis
    const customThumbnailUrl = document.getElementById('movie-thumbnail-url').value.trim();
    const thumbnailUrl = customThumbnailUrl || generateThumbnailUrl(videoUrl, title);

    const movieData = {
      title: title,
      video_url: videoUrl,
      thumbnail_url: thumbnailUrl,
      aspect_ratio: document.getElementById('movie-aspect-ratio').value || '16:9',
      description: document.getElementById('movie-description').value.trim() || null,
      category: document.getElementById('movie-category').value || 'lainnya',
      download_url: document.getElementById('movie-download-url').value.trim() || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('movies')
      .update(movieData)
      .eq('id', movieId);

    if (error) throw error;

    showNotification('Film berhasil diupdate!', 'success');
    
    // Reset form dan kembali ke mode tambah
    document.getElementById('movie-form').reset();
    document.querySelector('#add-movie-tab .section-header h2').textContent = '📤 Upload Film Baru';
    const submitBtn = document.querySelector('#add-movie-tab .submit-btn');
    submitBtn.innerHTML = '<span class="btn-icon">💾</span> Simpan Film';
    delete submitBtn.dataset.editId;
    
    // Kembalikan form submission ke mode tambah
    const form = document.getElementById('movie-form');
    form.onsubmit = handleAddMovie;
    
    document.getElementById('form-preview').innerHTML = `
      <div class="preview-placeholder">
        <span class="preview-icon">👆</span>
        <p>Isi form untuk melihat preview</p>
      </div>
    `;

    // Reload data
    await loadMovies();
    await loadStats();
    await loadRecentMovies();

    // Switch to dashboard tab
    switchTab('dashboard');

  } catch (error) {
    console.error('Error updating movie:', error);
    showNotification('Gagal mengupdate film: ' + error.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-icon">💾</span> Update Film';
  }
}

// Delete movie
window.deleteMovie = async function(movieId) {
  const movie = allMovies.find(m => m.id === movieId);
  if (!movie) return;

  if (!confirm(`Apakah Anda yakin ingin menghapus film "${movie.title}"?`)) {
    return;
  }

  showLoading();
  try {
    const { error } = await supabase
      .from('movies')
      .delete()
      .eq('id', movieId);
      
    if (error) {
      throw error;
    }
    
    showNotification(`Film "${movie.title}" berhasil dihapus!`, 'success');
    
    // Reload all data
    await loadMovies();
    await loadStats();
    await loadRecentMovies();
    await loadMoviesTable();
    
  } catch (error) {
    console.error('Error deleting movie:', error);
    showNotification('Gagal menghapus film: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
};

// Handle search
function handleSearch() {
  loadMoviesTable();
}

// Handle category filter
function handleCategoryFilter() {
  loadMoviesTable();
}

// Export data
async function exportData() {
  try {
    const { data: movies, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Convert to CSV
    const headers = ['ID', 'Title', 'Category', 'Aspect Ratio', 'Views', 'Video URL', 'Thumbnail URL', 'Download URL', 'Created At'];
    const csvData = movies.map(movie => [
      movie.id,
      `"${movie.title}"`,
      movie.category,
      movie.aspect_ratio || '16:9',
      movie.views,
      movie.video_url,
      movie.thumbnail_url,
      movie.download_url,
      movie.created_at
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.join(','))
      .join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duniafilm-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Data berhasil diexport', 'success');
  } catch (error) {
    console.error('Error exporting data:', error);
    showNotification('Gagal mengexport data', 'error');
  }
}

// Update last updated time
function updateLastUpdated() {
  const updateTimeEl = document.getElementById('update-time');
  if (updateTimeEl) {
    updateTimeEl.textContent = new Date().toLocaleString('id-ID');
  }
}

// Show/hide loading
function showLoading() {
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'flex';
}

function hideLoading() {
  const loading = document.getElementById('loading-overlay');
  if (loading) loading.style.display = 'none';
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notif => notif.remove());

  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;

  document.body.appendChild(notification);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

function getNotificationIcon(type) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  return icons[type] || 'ℹ️';
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

// Generate thumbnail URL
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
  
  // Cloudflare R2
  if (videoUrl.includes("r2.dev") || videoUrl.includes("cloudflarestorage.com")) {
    const fileName = videoUrl.split('/').pop();
    const baseName = fileName.split('.')[0];
    
    let displayName = baseName || 'Video';
    
    if (movieTitle && movieTitle.trim() !== '') {
      displayName = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
    } else {
      displayName = baseName.replace(/[-_]/g, ' ');
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
      displayName = displayName.length > 20 ? displayName.substring(0, 20) + '...' : displayName;
    }
    
    const colors = ['667eea', '764ba2', 'f093fb', '4facfe', '00f2fe'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    return `https://placehold.co/400x225/${randomColor}/ffffff?text=${encodeURIComponent(displayName)}+%0A%F0%9F%94%A5+Cloudflare+R2`;
  }
  
  // Vimeo thumbnail
  if (videoUrl.includes("vimeo.com")) {
    const videoId = videoUrl.split('vimeo.com/')[1]?.split('/')[0]?.split('?')[0];
    if (videoId && /^\d+$/.test(videoId)) {
      return `https://vumbnail.com/${videoId}.jpg`;
    }
  }
  
  // Direct image URLs
  if (videoUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) {
    return videoUrl;
  }
  
  // Default placeholder
  const shortTitle = movieTitle.length > 20 ? movieTitle.substring(0, 20) + '...' : movieTitle;
  return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(shortTitle || 'Video')}`;
}