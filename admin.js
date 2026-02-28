// =============================================
//   DUNIAFILM ADMIN PANEL — admin.js
//   Fixed: edit bug, bulk URL, clean code
// =============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────
//  STATE
// ─────────────────────────────────
let allMovies = [];
let selectedMovies = new Set();

// Edit mode state — single source of truth
let editingMovieId = null;

// Thumbnail picker state
let thumbVideoEl = null;
let thumbCanvas = null;

// ─────────────────────────────────
//  INIT
// ─────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (localStorage.getItem('adminLoggedIn') !== 'true') return;
  await initApp();
});

async function initApp() {
  showLoading();
  setupFormSubmit();
  setupThumbPicker();
  await loadAllMovies();
  await renderDashboard();
  hideLoading();
}

// ─────────────────────────────────
//  SUPABASE DATA
// ─────────────────────────────────
async function loadAllMovies() {
  try {
    const { data, error } = await supabase
      .from('movies').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    allMovies = data || [];
  } catch (err) {
    showNotif('Gagal memuat data: ' + err.message, 'error');
  }
}

// ─────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────
async function renderDashboard() {
  const totalMovies = allMovies.length;
  const totalViews = allMovies.reduce((s, m) => s + (m.views || 0), 0);

  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const recentCount = allMovies.filter(m => new Date(m.created_at) >= sevenAgo).length;

  const catMap = {};
  allMovies.forEach(m => { catMap[m.category] = (catMap[m.category] || 0) + 1; });

  // Stats
  document.getElementById('st-total').textContent = totalMovies;
  document.getElementById('st-views').textContent = fmtViews(totalViews);
  document.getElementById('st-recent').textContent = recentCount;
  document.getElementById('st-cats').textContent = Object.keys(catMap).length;

  // Category bars
  const barsEl = document.getElementById('cat-bars');
  if (totalMovies === 0) {
    barsEl.innerHTML = '<p style="color:var(--text-3);font-size:13px;">Belum ada data</p>';
  } else {
    barsEl.innerHTML = Object.entries(catMap).map(([cat, cnt]) => `
      <div class="cat-row">
        <div class="cat-name">${catDisplayName(cat)}</div>
        <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(cnt/totalMovies*100).toFixed(1)}%"></div></div>
        <div class="cat-count">${cnt}</div>
      </div>
    `).join('');
  }

  // Recent movies (last 6)
  const recent = allMovies.slice(0, 6);
  const rGrid = document.getElementById('recent-grid');
  if (recent.length === 0) {
    rGrid.innerHTML = '<div class="empty-state"><div class="ei">📭</div><p>Belum ada film</p></div>';
  } else {
    rGrid.innerHTML = recent.map(m => {
      const thumb = m.thumbnail_url || genThumb(m.video_url, m.title);
      return `
        <div class="recent-card">
          <img class="recent-thumb" src="${thumb}" alt="${m.title}"
               onerror="this.src='https://placehold.co/320x180/e8eaed/9aa0b0?text=No+Img'">
          <div class="recent-info">
            <div class="recent-title">${m.title}</div>
            <div class="recent-meta"><span>▶ ${fmtViews(m.views||0)}</span><span>${fmtDate(m.created_at)}</span></div>
          </div>
        </div>
      `;
    }).join('');
  }
}

// ─────────────────────────────────
//  MOVIE FORM — SINGLE HANDLER (fixes duplicate-insert bug)
// ─────────────────────────────────
function setupFormSubmit() {
  const form = document.getElementById('movie-form');

  // Live preview
  ['f-title','f-video-url','f-aspect','f-category'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateFormPreview);
    if (el) el.addEventListener('change', updateFormPreview);
  });

  // ONE submit listener — no dual-handler issue
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (editingMovieId !== null) {
      await doUpdateMovie(editingMovieId);
    } else {
      await doAddMovie();
    }
  });
}

function getFormData() {
  const videoUrl = document.getElementById('f-video-url').value.trim();
  const title = document.getElementById('f-title').value.trim();
  const customThumb = document.getElementById('f-thumb-url').value.trim();
  return {
    title,
    video_url: videoUrl,
    thumbnail_url: customThumb || genThumb(videoUrl, title),
    aspect_ratio: document.getElementById('f-aspect').value || '16:9',
    description: document.getElementById('f-desc').value.trim() || null,
    category: document.getElementById('f-category').value || 'lainnya',
    download_url: document.getElementById('f-download').value.trim() || null,
  };
}

async function doAddMovie() {
  const data = getFormData();
  if (!data.title || !data.video_url) {
    showNotif('Judul film dan URL video wajib diisi', 'error'); return;
  }

  const btn = document.getElementById('form-submit-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Menyimpan...';

  try {
    const { error } = await supabase.from('movies').insert([{
      ...data, views: 0, created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    showNotif('✅ Film berhasil ditambahkan!', 'success');
    resetForm();
    await loadAllMovies();
    await renderDashboard();
    switchTab('dashboard');
  } catch (err) {
    showNotif('Gagal menambahkan: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Simpan Film';
  }
}

async function doUpdateMovie(movieId) {
  const data = getFormData();
  if (!data.title || !data.video_url) {
    showNotif('Judul film dan URL video wajib diisi', 'error'); return;
  }

  const btn = document.getElementById('form-submit-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Mengupdate...';

  try {
    const { error } = await supabase.from('movies')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', movieId);
    if (error) throw error;
    showNotif('✅ Film berhasil diupdate!', 'success');
    cancelEdit();
    await loadAllMovies();
    await renderDashboard();
    await loadMoviesTable();
    switchTab('manage-movies', null);
  } catch (err) {
    showNotif('Gagal mengupdate: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingMovieId ? '💾 Update Film' : '💾 Simpan Film';
  }
}

// ─────────────────────────────────
//  EDIT / CANCEL
// ─────────────────────────────────
window.editMovie = function(movieId) {
  const movie = allMovies.find(m => m.id === movieId);
  if (!movie) return;

  editingMovieId = movieId;

  document.getElementById('f-title').value = movie.title || '';
  document.getElementById('f-video-url').value = movie.video_url || '';
  document.getElementById('f-desc').value = movie.description || '';
  document.getElementById('f-category').value = movie.category || 'lainnya';
  document.getElementById('f-download').value = movie.download_url || '';
  document.getElementById('f-thumb-url').value = movie.thumbnail_url || '';
  document.getElementById('f-aspect').value = movie.aspect_ratio || '16:9';

  document.getElementById('form-page-title').textContent = '✏️ Edit Film';
  document.getElementById('form-submit-btn').textContent = '💾 Update Film';

  const editBar = document.getElementById('edit-mode-bar');
  document.getElementById('edit-movie-name').textContent = movie.title;
  editBar.classList.add('visible');

  updateFormPreview();
  switchTab('add-movie', null);
  showNotif(`Mode edit: ${movie.title}`, 'info');
};

window.cancelEdit = function() {
  editingMovieId = null;
  resetForm();
  document.getElementById('edit-mode-bar').classList.remove('visible');
  document.getElementById('form-page-title').textContent = '📤 Upload Film Baru';
  document.getElementById('form-submit-btn').textContent = '💾 Simpan Film';
};

window.resetForm = function() {
  document.getElementById('movie-form').reset();
  document.getElementById('f-thumb-url').value = '';
  document.getElementById('form-preview').innerHTML = `
    <div class="preview-placeholder"><span class="pi">🎬</span><p>Isi form untuk melihat preview</p></div>
  `;
  if (editingMovieId !== null) cancelEdit();
};

// ─────────────────────────────────
//  FORM PREVIEW
// ─────────────────────────────────
function updateFormPreview() {
  const title = document.getElementById('f-title').value;
  const videoUrl = document.getElementById('f-video-url').value;
  const customThumb = document.getElementById('f-thumb-url').value;
  const preview = document.getElementById('form-preview');

  if (!title && !videoUrl) {
    preview.innerHTML = `<div class="preview-placeholder"><span class="pi">🎬</span><p>Isi form untuk melihat preview</p></div>`;
    return;
  }

  const thumb = customThumb || genThumb(videoUrl, title);
  preview.innerHTML = `
    <div class="movie-preview-wrap">
      <div class="movie-preview-thumb">
        <img src="${thumb}" onerror="this.src='https://placehold.co/400x225/e8eaed/9aa0b0?text=Preview'">
      </div>
      <div class="movie-preview-info">
        <div class="movie-preview-title">${title || 'Judul Film'}</div>
        <div class="movie-preview-url">${videoUrl || '—'}</div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────
//  MOVIES TABLE
// ─────────────────────────────────
window.loadMoviesTable = async function() {
  await loadAllMovies();
  renderMoviesTable();
};

function renderMoviesTable() {
  const search = (document.getElementById('tbl-search')?.value || '').toLowerCase();
  const cat = document.getElementById('tbl-cat')?.value || 'all';

  let movies = allMovies;
  if (cat !== 'all') movies = movies.filter(m => m.category === cat);
  if (search) movies = movies.filter(m =>
    m.title?.toLowerCase().includes(search) ||
    m.description?.toLowerCase().includes(search)
  );

  const tbody = document.getElementById('movies-tbody');
  const info = document.getElementById('tbl-info');

  info.textContent = `Menampilkan ${movies.length} dari ${allMovies.length} film`;

  if (movies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="ei">📭</div><p>Tidak ada film ditemukan</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = movies.map(m => {
    const thumb = m.thumbnail_url || genThumb(m.video_url, m.title);
    const isSel = selectedMovies.has(m.id);
    return `
      <tr class="${isSel ? 'row-selected' : ''}">
        <td><input type="checkbox" ${isSel?'checked':''} onchange="toggleSelect(${m.id})"></td>
        <td class="hide-mobile"><img class="table-thumb" src="${thumb}" alt=""
             onerror="this.src='https://placehold.co/60x40/e8eaed/9aa0b0?text=No'"></td>
        <td>
          <div class="movie-name">${m.title}</div>
          ${m.description ? `<div class="movie-name-desc">${m.description}</div>` : ''}
        </td>
        <td class="hide-mobile"><span class="badge badge-${m.category}">${catDisplayName(m.category)}</span></td>
        <td class="hide-mobile"><span class="ar-badge">${m.aspect_ratio || '16:9'}</span></td>
        <td><span class="views-num">${fmtViews(m.views||0)}</span></td>
        <td class="hide-mobile"><span class="date-txt">${fmtDate(m.created_at)}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost" onclick="editMovie(${m.id})">✏️</button>
            <button class="btn btn-danger" onclick="deleteMovie(${m.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  updateBulkBar();
}

window.handleSearch = function() { renderMoviesTable(); };

window.toggleSelect = function(id) {
  selectedMovies.has(id) ? selectedMovies.delete(id) : selectedMovies.add(id);
  renderMoviesTable();
};

window.toggleSelectAll = function(checked) {
  const search = (document.getElementById('tbl-search')?.value || '').toLowerCase();
  const cat = document.getElementById('tbl-cat')?.value || 'all';
  let movies = allMovies;
  if (cat !== 'all') movies = movies.filter(m => m.category === cat);
  if (search) movies = movies.filter(m =>
    m.title?.toLowerCase().includes(search) || m.description?.toLowerCase().includes(search)
  );
  selectedMovies.clear();
  if (checked) movies.forEach(m => selectedMovies.add(m.id));
  renderMoviesTable();
};

function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const countEl = document.getElementById('bulk-count');
  if (selectedMovies.size > 0) {
    bar.classList.add('visible');
    countEl.textContent = `${selectedMovies.size} film terpilih`;
  } else {
    bar.classList.remove('visible');
  }
}

// ─────────────────────────────────
//  DELETE
// ─────────────────────────────────
window.deleteMovie = async function(movieId) {
  const movie = allMovies.find(m => m.id === movieId);
  if (!confirm(`Hapus film "${movie?.title}"?`)) return;
  showLoading();
  try {
    const { error } = await supabase.from('movies').delete().eq('id', movieId);
    if (error) throw error;
    showNotif('Film berhasil dihapus!', 'success');
    selectedMovies.delete(movieId);
    await loadAllMovies();
    await renderDashboard();
    renderMoviesTable();
  } catch (err) {
    showNotif('Gagal menghapus: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

window.bulkDelete = async function() {
  if (selectedMovies.size === 0) { showNotif('Pilih film terlebih dahulu', 'warning'); return; }
  if (!confirm(`Hapus ${selectedMovies.size} film yang dipilih?`)) return;
  showLoading();
  try {
    const { error } = await supabase.from('movies').delete().in('id', [...selectedMovies]);
    if (error) throw error;
    showNotif(`${selectedMovies.size} film berhasil dihapus!`, 'success');
    selectedMovies.clear();
    await loadAllMovies();
    await renderDashboard();
    renderMoviesTable();
  } catch (err) {
    showNotif('Gagal menghapus: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
};

// ─────────────────────────────────
//  BULK URL — Edit URL banyak film sekaligus
// ─────────────────────────────────
window.renderBulkTable = function() {
  const search = (document.getElementById('bulk-search')?.value || '').toLowerCase();
  const cat = document.getElementById('bulk-cat')?.value || 'all';
  const field = document.getElementById('bulk-field')?.value || 'video_url';

  let movies = allMovies;
  if (cat !== 'all') movies = movies.filter(m => m.category === cat);
  if (search) movies = movies.filter(m => m.title?.toLowerCase().includes(search));

  const tbody = document.getElementById('bulk-url-tbody');
  if (movies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="ei">📭</div><p>Tidak ada film</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = movies.map((m, i) => {
    const currentUrl = m[field] || '';
    return `
      <tr>
        <td style="color:var(--text-3);font-size:12px;">${i+1}</td>
        <td class="bulk-url-title-cell" title="${m.title}">${m.title}</td>
        <td><div class="bulk-url-old" title="${currentUrl}">${currentUrl || '—'}</div></td>
        <td>
          <input type="url" class="bulk-url-input" data-movie-id="${m.id}" data-field="${field}"
                 data-original="${currentUrl}"
                 placeholder="URL baru (kosongkan untuk tidak mengubah)"
                 oninput="onBulkUrlInput(this)">
        </td>
      </tr>
    `;
  }).join('');

  updateBulkChangeCount();
};

window.onBulkUrlInput = function(input) {
  const newVal = input.value.trim();
  const orig = input.dataset.original;
  input.classList.toggle('changed', newVal !== '' && newVal !== orig);
  updateBulkChangeCount();
};

function updateBulkChangeCount() {
  const changed = document.querySelectorAll('.bulk-url-input.changed').length;
  const el = document.getElementById('bulk-change-count');
  el.textContent = changed > 0 ? `${changed} perubahan belum disimpan` : '';
  el.style.color = changed > 0 ? 'var(--warning)' : 'var(--text-2)';
}

window.resetBulkInputs = function() {
  document.querySelectorAll('.bulk-url-input').forEach(i => {
    i.value = '';
    i.classList.remove('changed');
  });
  updateBulkChangeCount();
};

window.saveBulkUrls = async function() {
  const changed = [...document.querySelectorAll('.bulk-url-input.changed')];
  if (changed.length === 0) { showNotif('Tidak ada perubahan untuk disimpan', 'warning'); return; }
  if (!confirm(`Simpan ${changed.length} perubahan URL?`)) return;

  showLoading();
  let success = 0, failed = 0;
  for (const input of changed) {
    const movieId = parseInt(input.dataset.movieId);
    const field = input.dataset.field;
    const newUrl = input.value.trim();
    try {
      const { error } = await supabase.from('movies')
        .update({ [field]: newUrl, updated_at: new Date().toISOString() })
        .eq('id', movieId);
      if (error) throw error;
      success++;
      input.classList.remove('changed');
      input.dataset.original = newUrl;
    } catch {
      failed++;
    }
  }
  hideLoading();
  if (failed === 0) {
    showNotif(`✅ ${success} URL berhasil diupdate!`, 'success');
  } else {
    showNotif(`${success} berhasil, ${failed} gagal`, 'warning');
  }
  await loadAllMovies();
  renderBulkTable();
  updateBulkChangeCount();
};

// Bulk URL edit dari selected movies di tabel kelola
window.bulkEditUrl = function() {
  if (selectedMovies.size === 0) { showNotif('Pilih film terlebih dahulu', 'warning'); return; }
  // Pre-fill bulk URL table with selected only
  const catEl = document.getElementById('bulk-cat');
  const searchEl = document.getElementById('bulk-search');
  if (catEl) catEl.value = 'all';
  if (searchEl) searchEl.value = '';
  switchTab('bulk-url', null);
  // highlight selected
  setTimeout(() => {
    const allInputs = document.querySelectorAll('.bulk-url-input');
    allInputs.forEach(inp => {
      const id = parseInt(inp.dataset.movieId);
      if (!selectedMovies.has(id)) {
        inp.closest('tr').style.opacity = '0.4';
      } else {
        inp.closest('tr').style.opacity = '1';
        inp.focus && inp.closest('tr').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, 100);
};

// ─────────────────────────────────
//  THUMBNAIL PICKER
// ─────────────────────────────────
function setupThumbPicker() {
  document.getElementById('btn-pick-thumb')?.addEventListener('click', openThumbModal);
}

async function openThumbModal() {
  const videoUrl = document.getElementById('f-video-url').value.trim();
  if (!videoUrl) { showNotif('Masukkan URL video terlebih dahulu', 'error'); return; }

  const modal = document.getElementById('modal-thumb');
  const wrap = document.getElementById('thumb-video-wrap');
  wrap.innerHTML = '';

  thumbVideoEl = document.createElement('video');
  thumbVideoEl.crossOrigin = 'anonymous';
  thumbVideoEl.preload = 'metadata';
  thumbVideoEl.style.width = '100%';
  thumbVideoEl.style.height = '100%';

  thumbCanvas = document.createElement('canvas');

  thumbVideoEl.addEventListener('loadedmetadata', () => {
    const dur = Math.floor(thumbVideoEl.duration);
    const seek = document.getElementById('thumb-seek');
    seek.max = dur;
    seek.value = Math.min(30, Math.floor(dur * 0.1));
    onSeekChange();
    hideLoading();
  });

  thumbVideoEl.addEventListener('error', () => {
    hideLoading();
    showNotif('Gagal memuat video untuk thumbnail', 'error');
  });

  thumbVideoEl.src = videoUrl;
  wrap.appendChild(thumbVideoEl);

  const formAR = document.getElementById('f-aspect').value;
  document.getElementById('thumb-aspect').value = formAR;

  showLoading();
  modal.classList.add('open');
}

window.onSeekChange = function() {
  const seek = document.getElementById('thumb-seek');
  const timeEl = document.getElementById('thumb-time');
  const preview = document.getElementById('thumb-preview');
  const ar = document.getElementById('thumb-aspect')?.value || '16:9';

  if (!thumbVideoEl || !thumbCanvas) return;

  const t = parseInt(seek.value);
  const dur = thumbVideoEl.duration || 0;
  timeEl.textContent = `${fmtTime(t)} / ${fmtTime(dur)}`;

  const sizes = { '16:9':{w:400,h:225}, '9:16':{w:225,h:400}, '3:4':{w:300,h:400}, '4:3':{w:400,h:300} };
  const sz = sizes[ar] || sizes['16:9'];
  thumbCanvas.width = sz.w;
  thumbCanvas.height = sz.h;

  thumbVideoEl.currentTime = t;
  thumbVideoEl.onseeked = () => {
    const ctx = thumbCanvas.getContext('2d');
    ctx.clearRect(0, 0, sz.w, sz.h);
    ctx.drawImage(thumbVideoEl, 0, 0, sz.w, sz.h);
    const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
    preview.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;">`;
  };
};

window.confirmThumb = function() {
  if (!thumbCanvas) return;
  const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.85);
  const thumbInput = document.getElementById('f-thumb-url');
  thumbInput.value = dataUrl;
  thumbInput.removeAttribute('readonly');
  // sync aspect ratio
  document.getElementById('f-aspect').value = document.getElementById('thumb-aspect').value;
  updateFormPreview();
  closeThumbModal();
  showNotif('Thumbnail berhasil dipilih!', 'success');
};

window.closeThumbModal = function() {
  document.getElementById('modal-thumb').classList.remove('open');
  if (thumbVideoEl) { thumbVideoEl.pause(); thumbVideoEl.src = ''; thumbVideoEl = null; }
  thumbCanvas = null;
};

// ─────────────────────────────────
//  EXPORT
// ─────────────────────────────────
window.exportData = function() {
  const headers = ['ID','Title','Category','Aspect Ratio','Views','Video URL','Thumbnail URL','Download URL','Created At'];
  const rows = allMovies.map(m => [
    m.id, `"${m.title}"`, m.category, m.aspect_ratio||'16:9', m.views||0,
    m.video_url, m.thumbnail_url||'', m.download_url||'', m.created_at
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `duniafilm-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotif('Data berhasil diexport!', 'success');
};

// ─────────────────────────────────
//  HELPERS
// ─────────────────────────────────
function fmtViews(v) {
  if (v >= 1e6) return (v/1e6).toFixed(1) + 'JT';
  if (v >= 1e3) return (v/1e3).toFixed(1) + 'K';
  return v.toString();
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' }) : '—';
}

function fmtTime(s) {
  if (!s || isNaN(s)) return '00:00';
  const m = Math.floor(s/60);
  const sec = Math.floor(s%60);
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function catDisplayName(cat) {
  return ({ colmek:'Colmek', berdua:'Berdua', bergilir:'Bergilir', lainnya:'Lainnya' }[cat]) || cat;
}

function genThumb(videoUrl, title = '') {
  if (!videoUrl) return `https://placehold.co/400x225/e8eaed/9aa0b0?text=No+Video`;
  
  if (videoUrl.includes('youtube.com/watch')) {
    const vid = new URL(videoUrl).searchParams.get('v');
    if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  }
  if (videoUrl.includes('youtu.be/')) {
    const vid = videoUrl.split('youtu.be/')[1]?.split('?')[0];
    if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  }
  if (videoUrl.includes('drive.google.com')) {
    let fid = '';
    if (videoUrl.includes('/file/d/')) fid = videoUrl.split('/file/d/')[1]?.split('/')[0];
    else if (videoUrl.includes('id=')) fid = new URL(videoUrl).searchParams.get('id') || '';
    if (fid) return `https://lh3.googleusercontent.com/d/${fid}=s400`;
  }
  if (videoUrl.includes('vimeo.com')) {
    const vid = videoUrl.split('vimeo.com/')[1]?.split('/')[0]?.split('?')[0];
    if (vid && /^\d+$/.test(vid)) return `https://vumbnail.com/${vid}.jpg`;
  }
  const short = (title || 'Video').substring(0, 20);
  return `https://placehold.co/400x225/3b5bdb/ffffff?text=${encodeURIComponent(short)}`;
}

// Expose tab switcher to HTML onclick
window.switchTab = function(name, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('tab-' + name);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.nav-item, .mobile-nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[data-tab="${name}"]`).forEach(b => b.classList.add('active'));

  if (name === 'manage-movies') { loadAllMovies().then(renderMoviesTable); }
  if (name === 'bulk-url') { renderBulkTable(); }
};

// Init again if login happens after page load
window.addEventListener('storage', (e) => {
  if (e.key === 'adminLoggedIn' && e.newValue === 'true') initApp();
});

// Also support login from same tab (poll)
let _authPolled = false;
const authPoll = setInterval(() => {
  if (localStorage.getItem('adminLoggedIn') === 'true' && !_authPolled) {
    _authPolled = true;
    clearInterval(authPoll);
    if (allMovies.length === 0) initApp();
  }
}, 500);
