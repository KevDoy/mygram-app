/**
 * admin.js – Admin page logic for managing photos.json and pals.json.
 *
 * Loads both JSON files, provides editing UIs, and downloads
 * modified versions for the user to replace their originals.
 */

(async function () {
  "use strict";

  // =========================================================
  //  State
  // =========================================================
  let _photosData = { profile: {}, photos: [], albums: [] };
  let _palsData = { pals: [] };
  let _deleteIndex = -1;
  let _deleteAlbumIndex = -1;
  let _editingAlbumIndex = -1; // -1 = creating new
  let _selectedPhotos = new Set(); // filenames selected for current album

  // =========================================================
  //  Helpers
  // =========================================================
  function showToast(message) {
    const toast = document.getElementById("adminToast");
    const body = document.getElementById("adminToastBody");
    if (!toast || !body) return;
    body.textContent = message;
    new bootstrap.Toast(toast, { delay: 2000 }).show();
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(filename + " downloaded — replace the file in your repo.");
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // =========================================================
  //  Load data
  // =========================================================
  async function loadPhotosJSON() {
    try {
      const res = await fetch("data/photos.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      _photosData = await res.json();
      if (!_photosData.profile) _photosData.profile = {};
      if (!_photosData.photos) _photosData.photos = [];
      if (!_photosData.albums) _photosData.albums = [];
    } catch (e) {
      console.error("Admin: could not load photos.json", e);
      showToast("Could not load photos.json");
    }
  }

  async function loadPalsJSON() {
    try {
      const res = await fetch("palgram/pals.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      _palsData = await res.json();
      if (!_palsData.pals) _palsData.pals = [];
    } catch (e) {
      console.error("Admin: could not load pals.json", e);
      showToast("Could not load pals.json");
    }
  }

  // =========================================================
  //  Profile Section
  // =========================================================
  function populateProfileForm() {
    const p = _photosData.profile;
    document.getElementById("profUsername").value = p.username || "";
    document.getElementById("profFullName").value = p.fullName || "";
    document.getElementById("profBio").value = p.bio || "";
    document.getElementById("profBioLink").value = p.bioLink || "";
    document.getElementById("profPhoto").value = p.profilePhoto || "";
  }

  function readProfileForm() {
    _photosData.profile.username = document.getElementById("profUsername").value.trim();
    _photosData.profile.fullName = document.getElementById("profFullName").value.trim();
    _photosData.profile.bio = document.getElementById("profBio").value.trim();
    _photosData.profile.bioLink = document.getElementById("profBioLink").value.trim();
    _photosData.profile.profilePhoto = document.getElementById("profPhoto").value.trim();
  }

  // =========================================================
  //  Photos Section
  // =========================================================
  function renderPhotoList() {
    const container = document.getElementById("photoList");
    const countBadge = document.getElementById("photoCount");
    const photos = _photosData.photos;

    countBadge.textContent = photos.length + " photo" + (photos.length !== 1 ? "s" : "");

    if (photos.length === 0) {
      container.innerHTML = '<div class="photos-empty"><i class="bi bi-camera d-block mb-1" style="font-size:1.5rem"></i>No photos in photos.json</div>';
      return;
    }

    container.innerHTML = "";
    photos.forEach((photo, i) => {
      const thumbSrc = photo.thumbnail
        ? "photos/thumbnails/360/" + photo.thumbnail
        : (photo.web ? "photos/web/" + photo.web : "");

      const item = document.createElement("div");
      item.className = "photo-item";
      item.innerHTML = `
        ${thumbSrc ? `<img class="photo-item-thumb" src="${thumbSrc}" alt="" loading="lazy">` : '<div class="photo-item-thumb"></div>'}
        <div class="photo-item-info">
          <div class="photo-item-filename" title="${photo.filename || ""}">${photo.filename || "untitled"}</div>
          <textarea class="photo-item-caption" rows="1" data-index="${i}" placeholder="Add a caption…">${photo.caption || ""}</textarea>
          <div class="photo-item-meta">
            ${photo.date || ""}${photo.location ? " · " + photo.location : ""}${photo.camera ? " · " + photo.camera : ""}
          </div>
        </div>
        <div class="photo-item-actions">
          <button class="btn-delete-photo" data-index="${i}" title="Delete photo" aria-label="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // =========================================================
  //  Pals Section
  // =========================================================
  function renderPalsList() {
    const container = document.getElementById("palsList");
    const pals = _palsData.pals;

    if (pals.length === 0) {
      container.innerHTML = '<div class="pals-empty"><i class="bi bi-people d-block mb-1" style="font-size:1.5rem"></i>No pals added yet</div>';
      return;
    }

    container.innerHTML = "";
    pals.forEach((pal, i) => {
      const item = document.createElement("div");
      item.className = "pal-item";
      item.innerHTML = `
        <i class="bi bi-link-45deg text-muted"></i>
        <span class="pal-item-url">${pal.url}</span>
        <button class="btn-remove-pal" data-index="${i}" title="Remove" aria-label="Remove pal">
          <i class="bi bi-x-lg"></i>
        </button>
      `;
      container.appendChild(item);
    });
  }

  function addPal() {
    const input = document.getElementById("newPalUrl");
    let url = input.value.trim();
    if (!url) return;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    if (_palsData.pals.some((p) => p.url === url)) {
      showToast("This URL is already in your pals list");
      return;
    }

    _palsData.pals.push({ url: url });
    input.value = "";
    renderPalsList();
    showToast("Pal added — download pals.json to save");
  }

  function removePal(index) {
    _palsData.pals.splice(index, 1);
    renderPalsList();
    showToast("Pal removed — download pals.json to save");
  }

  // =========================================================
  //  Albums Section
  // =========================================================
  function renderAlbumList() {
    const container = document.getElementById("albumList");
    const countBadge = document.getElementById("albumCount");
    const albums = _photosData.albums;

    countBadge.textContent = albums.length + " album" + (albums.length !== 1 ? "s" : "");

    if (albums.length === 0) {
      container.innerHTML = `
        <div class="photos-empty">
          <i class="bi bi-collection d-block mb-1" style="font-size:1.5rem"></i>
          No albums yet — create one below.
        </div>`;
      return;
    }

    container.innerHTML = "";
    albums.forEach((album, i) => {
      const photoCount = (album.photos || []).length;
      const item = document.createElement("div");
      item.className = "album-admin-item";
      item.innerHTML = `
        <div class="album-admin-info">
          <strong>${album.title || "Untitled"}</strong>
          <span class="text-muted small">${photoCount} photo${photoCount !== 1 ? "s" : ""}${album.description ? " · " + album.description : ""}</span>
        </div>
        <div class="album-admin-actions">
          <button class="btn-edit-album" data-index="${i}" title="Edit" aria-label="Edit album">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-delete-album" data-index="${i}" title="Delete" aria-label="Delete album">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  function renderPhotoSelector() {
    const container = document.getElementById("albumPhotoSelector");
    const coverSelect = document.getElementById("albumCoverSelect");
    const photos = _photosData.photos;

    container.innerHTML = "";
    // Reset cover dropdown
    coverSelect.innerHTML = '<option value="">Auto (first selected photo)</option>';

    if (photos.length === 0) {
      container.innerHTML = '<div class="text-muted small text-center py-3">No photos available</div>';
      return;
    }

    photos.forEach((photo) => {
      const thumbSrc = photo.thumbnail
        ? "photos/thumbnails/360/" + photo.thumbnail
        : (photo.web ? "photos/web/" + photo.web : "");
      const isSelected = _selectedPhotos.has(photo.filename);

      const item = document.createElement("div");
      item.className = "album-selector-item" + (isSelected ? " selected" : "");
      item.setAttribute("data-filename", photo.filename);
      item.innerHTML = `
        ${thumbSrc ? `<img src="${thumbSrc}" alt="" loading="lazy">` : '<div class="album-selector-placeholder"></div>'}
        <div class="album-selector-check"><i class="bi bi-check-lg"></i></div>
      `;
      container.appendChild(item);
    });

    updateCoverDropdown();
  }

  function updateCoverDropdown() {
    const coverSelect = document.getElementById("albumCoverSelect");
    const currentValue = coverSelect.value;
    coverSelect.innerHTML = '<option value="">Auto (first selected photo)</option>';
    _selectedPhotos.forEach((fn) => {
      const opt = document.createElement("option");
      opt.value = fn;
      opt.textContent = fn;
      if (fn === currentValue) opt.selected = true;
      coverSelect.appendChild(opt);
    });
  }

  function resetAlbumForm() {
    _editingAlbumIndex = -1;
    _selectedPhotos.clear();
    document.getElementById("albumTitle").value = "";
    document.getElementById("albumDesc").value = "";
    document.getElementById("albumCoverSelect").value = "";
    document.getElementById("albumFormTitle").innerHTML = '<i class="bi bi-plus-circle me-2"></i>Create Album';
    renderPhotoSelector();
  }

  function editAlbum(index) {
    const album = _photosData.albums[index];
    if (!album) return;
    _editingAlbumIndex = index;
    _selectedPhotos = new Set(album.photos || []);
    document.getElementById("albumTitle").value = album.title || "";
    document.getElementById("albumDesc").value = album.description || "";
    document.getElementById("albumFormTitle").innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Album';
    renderPhotoSelector();
    // Set cover after dropdown is populated
    document.getElementById("albumCoverSelect").value = album.cover || "";
    // Scroll to form
    document.getElementById("albumFormCard").scrollIntoView({ behavior: "smooth" });
  }

  function saveAlbum() {
    const title = document.getElementById("albumTitle").value.trim();
    if (!title) {
      showToast("Album title is required");
      return;
    }

    const description = document.getElementById("albumDesc").value.trim();
    const selectedArr = Array.from(_selectedPhotos);
    const coverValue = document.getElementById("albumCoverSelect").value;
    const cover = coverValue || (selectedArr.length > 0 ? selectedArr[0] : "");

    if (_editingAlbumIndex >= 0) {
      // Update existing
      const album = _photosData.albums[_editingAlbumIndex];
      album.title = title;
      album.description = description;
      album.cover = cover;
      album.photos = selectedArr;
      showToast("Album updated — download photos.json to save");
    } else {
      // Create new
      const id = slugify(title) || "album-" + Date.now();
      // Ensure unique ID
      let uniqueId = id;
      let counter = 2;
      while (_photosData.albums.some((a) => a.id === uniqueId)) {
        uniqueId = id + "-" + counter++;
      }
      _photosData.albums.push({
        id: uniqueId,
        title: title,
        description: description,
        cover: cover,
        photos: selectedArr,
      });
      showToast("Album created — download photos.json to save");
    }

    renderAlbumList();
    resetAlbumForm();
  }

  function deleteAlbum(index) {
    if (index >= 0 && index < _photosData.albums.length) {
      const removed = _photosData.albums.splice(index, 1);
      showToast((removed[0]?.title || "Album") + " deleted — download to save");
      renderAlbumList();
      if (_editingAlbumIndex === index) resetAlbumForm();
    }
  }

  // =========================================================
  //  Build JSON outputs
  // =========================================================
  function buildPhotosJSON() {
    readProfileForm();
    const out = {
      profile: _photosData.profile,
      photos: _photosData.photos,
    };
    if (_photosData.albums && _photosData.albums.length > 0) {
      out.albums = _photosData.albums;
    }
    return out;
  }

  function buildPalsJSON() {
    return {
      _instructions: "Add your friends' mygram URLs below. Each entry needs a \"url\" pointing to the root of their mygram site.",
      _example: { url: "https://friendname.github.io/mygram/" },
      pals: _palsData.pals,
    };
  }

  // =========================================================
  //  Event Wiring
  // =========================================================
  function initEvents() {
    // Save photos.json (from Profile tab)
    document.getElementById("savePhotosJson").addEventListener("click", () => {
      downloadJSON(buildPhotosJSON(), "photos.json");
    });

    // Save photos.json (from Photos tab)
    document.getElementById("savePhotosJsonFromPhotos").addEventListener("click", () => {
      downloadJSON(buildPhotosJSON(), "photos.json");
    });

    // Save photos.json (from Albums tab)
    document.getElementById("savePhotosJsonFromAlbums").addEventListener("click", () => {
      downloadJSON(buildPhotosJSON(), "photos.json");
    });

    // Save pals.json
    document.getElementById("savePalsJson").addEventListener("click", () => {
      downloadJSON(buildPalsJSON(), "pals.json");
    });

    // Add pal
    document.getElementById("addPalBtn").addEventListener("click", addPal);
    document.getElementById("newPalUrl").addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); addPal(); }
    });

    // Remove pal (delegation)
    document.getElementById("palsList").addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-remove-pal");
      if (!btn) return;
      const idx = parseInt(btn.dataset.index, 10);
      removePal(idx);
    });

    // Photo caption editing (delegation)
    document.getElementById("photoList").addEventListener("input", (e) => {
      if (!e.target.classList.contains("photo-item-caption")) return;
      const idx = parseInt(e.target.dataset.index, 10);
      if (_photosData.photos[idx]) {
        _photosData.photos[idx].caption = e.target.value;
      }
    });

    // Photo delete (delegation) — opens confirm modal
    const deleteModal = new bootstrap.Modal(document.getElementById("deleteModal"));

    document.getElementById("photoList").addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-delete-photo");
      if (!btn) return;
      _deleteIndex = parseInt(btn.dataset.index, 10);
      const photo = _photosData.photos[_deleteIndex];
      document.getElementById("deletePhotoName").textContent = photo ? photo.filename : "";
      deleteModal.show();
    });

    document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
      if (_deleteIndex >= 0 && _deleteIndex < _photosData.photos.length) {
        const removed = _photosData.photos.splice(_deleteIndex, 1);
        showToast((removed[0]?.filename || "Photo") + " deleted — download to save");
        renderPhotoList();
      }
      _deleteIndex = -1;
      deleteModal.hide();
    });

    // --- Albums events ---
    // Edit / Delete album (delegation)
    const albumListEl = document.getElementById("albumList");
    const deleteAlbumModal = new bootstrap.Modal(document.getElementById("deleteAlbumModal"));

    albumListEl.addEventListener("click", (e) => {
      const editBtn = e.target.closest(".btn-edit-album");
      if (editBtn) {
        editAlbum(parseInt(editBtn.dataset.index, 10));
        return;
      }
      const deleteBtn = e.target.closest(".btn-delete-album");
      if (deleteBtn) {
        _deleteAlbumIndex = parseInt(deleteBtn.dataset.index, 10);
        const album = _photosData.albums[_deleteAlbumIndex];
        document.getElementById("deleteAlbumName").textContent = album ? album.title : "";
        deleteAlbumModal.show();
      }
    });

    document.getElementById("confirmDeleteAlbumBtn").addEventListener("click", () => {
      deleteAlbum(_deleteAlbumIndex);
      _deleteAlbumIndex = -1;
      deleteAlbumModal.hide();
    });

    // Photo selector toggle (delegation)
    document.getElementById("albumPhotoSelector").addEventListener("click", (e) => {
      const item = e.target.closest(".album-selector-item");
      if (!item) return;
      const fn = item.dataset.filename;
      if (_selectedPhotos.has(fn)) {
        _selectedPhotos.delete(fn);
        item.classList.remove("selected");
      } else {
        _selectedPhotos.add(fn);
        item.classList.add("selected");
      }
      updateCoverDropdown();
    });

    // Album form save / cancel
    document.getElementById("albumFormSave").addEventListener("click", saveAlbum);
    document.getElementById("albumFormCancel").addEventListener("click", resetAlbumForm);
  }

  // =========================================================
  //  Init
  // =========================================================
  await Promise.all([loadPhotosJSON(), loadPalsJSON()]);

  populateProfileForm();
  renderPhotoList();
  renderPalsList();
  renderAlbumList();
  renderPhotoSelector();
  initEvents();
})();
