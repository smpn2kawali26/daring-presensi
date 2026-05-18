// ==================== KONFIGURASI ====================
const API_URL = 'https://script.google.com/macros/s/AKfycbxcw0J59ojWkJxQJKRgn8UmNLHee1qwyAmMCR3oU2DmveaqjHDXP8_lryRlJV0cJrljBQ/exec';

let currentStream = null;
let capturedPhoto = null;
let currentLocation = null;
let currentFacingMode = 'user';
let selectedFiles = [];

// Data statistik simulasi (akan terupdate dari backend)
let statistikData = {
    '7a': { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 },
    '7b': { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 },
    '7c': { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 },
    '8a': { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 },
    '8b': { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 },
    '8c': { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 }
};

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    getLocationOnly();
    
    // Event listener aktivitas
    document.getElementById('aktivitas').addEventListener('change', function() {
        const aktivitas = this.value;
        const cameraSection = document.getElementById('cameraSection');
        const cameraSelectGroup = document.getElementById('cameraSelectGroup');
        const uploadGroup = document.getElementById('uploadTugasGroup');
        
        if (aktivitas === 'Upload Tugas') {
            cameraSection.style.display = 'none';
            cameraSelectGroup.style.display = 'none';
            uploadGroup.style.display = 'block';
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        } else if (aktivitas === 'Absen Masuk' || aktivitas === 'Absen Pulang' || aktivitas === 'Izin') {
            cameraSection.style.display = 'block';
            cameraSelectGroup.style.display = 'block';
            uploadGroup.style.display = 'none';
            startCamera();
        } else {
            cameraSection.style.display = 'none';
            cameraSelectGroup.style.display = 'none';
            uploadGroup.style.display = 'none';
        }
    });
    
    // Event listener pilihan kamera
    document.getElementById('cameraSelect').addEventListener('change', function() {
        currentFacingMode = this.value;
        startCamera();
    });
    
    // Event listener tombol
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);
    document.getElementById('retakeBtn').addEventListener('click', retakePhoto);
    document.getElementById('submitBtn').addEventListener('click', submitForm);
    
    // Event listener multiple file
    document.getElementById('fileTugas').addEventListener('change', handleFileSelect);
    
    // Load data dari localStorage (data sementara)
    loadStatsFromLocal();
    
    // Set refresh statistik setiap 30 detik
    setInterval(refreshStats, 30000);
});

// ==================== CEK JAM OPERASIONAL ====================
function isOperationalHour() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    const startTime = 6 * 60 + 45; // 06:45
    const endTime = 14 * 60 + 0;   // 14:00
    
    return currentTime >= startTime && currentTime <= endTime;
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').innerHTML = now.toLocaleDateString('id-ID', options);
    document.getElementById('time').innerHTML = now.toLocaleTimeString('id-ID');
    
    const statusDiv = document.getElementById('statusJam');
    if (isOperationalHour()) {
        statusDiv.innerHTML = '✅ Waktu Presensi: BUKA (06:45 - 14:00)';
        statusDiv.className = 'jam-status open';
    } else {
        statusDiv.innerHTML = '⛔ Waktu Presensi: TUTUP (Buka 06:45 - 14:00)';
        statusDiv.className = 'jam-status closed';
    }
}

// ==================== KAMERA ====================
async function startCamera() {
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: { exact: currentFacingMode }
            }
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('video');
        video.srcObject = currentStream;
        video.setAttribute('playsinline', true);
        
        // Reset tampilan
        document.getElementById('video').style.display = 'block';
        document.getElementById('canvas').style.display = 'none';
        document.getElementById('captureBtn').style.display = 'inline-block';
        document.getElementById('retakeBtn').style.display = 'none';
        document.getElementById('photoPreview').innerHTML = '';
        capturedPhoto = null;
        
    } catch (err) {
        console.error('Camera error:', err);
        const wrapper = document.querySelector('.video-wrapper');
        if (wrapper) {
            wrapper.innerHTML = `<div style="padding:20px;color:red;text-align:center;">
                <i class="fas fa-camera-slash" style="font-size:32px;margin-bottom:10px;display:block;"></i>
                ⚠️ Izin kamera ditolak. Silakan izinkan akses kamera.<br>
                <small>Error: ${err.message}</small>
            </div>`;
        }
    }
}

function capturePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    // Kompress foto (kualitas 50% untuk ukuran kecil)
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.5);
    
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = `<img src="${capturedPhoto}" alt="Foto">`;
    
    video.style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'inline-block';
    
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
}

function retakePhoto() {
    capturedPhoto = null;
    startCamera();
}

// ==================== HANDLE MULTIPLE FILE UPLOAD ====================
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    selectedFiles = [];
    
    if (files.length > 5) {
        alert('Maksimal 5 file!');
        document.getElementById('fileTugas').value = '';
        return;
    }
    
    const previewContainer = document.getElementById('filePreview');
    previewContainer.innerHTML = '';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 2 * 1024 * 1024) {
            alert(`File ${file.name} terlalu besar! Maksimal 2MB`);
            continue;
        }
        
        selectedFiles.push(file);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'file-preview-item';
            div.setAttribute('data-index', i);
            div.innerHTML = `
                <img src="${e.target.result}">
                <div class="remove-file" onclick="removeFile(${i})">×</div>
            `;
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    handleFileSelect({ target: { files: selectedFiles, value: '' } });
}

// ==================== GPS ====================
function getLocationOnly() {
    const gpsDiv = document.getElementById('gpsStatus');
    if (!navigator.geolocation) {
        gpsDiv.innerHTML = '⚠️ GPS tidak didukung';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(pos) {
            currentLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: Math.round(pos.coords.accuracy)
            };
            gpsDiv.innerHTML = `✅ Lokasi tercatat: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)} (Akurasi: ${currentLocation.accuracy}m)`;
            gpsDiv.className = 'gps-status gps-success';
        },
        function() {
            gpsDiv.innerHTML = '⚠️ Izin lokasi ditolak, lokasi tidak akan tercatat';
            gpsDiv.className = 'gps-status gps-error';
            currentLocation = { lat: 0, lng: 0, accuracy: 0 };
        }
    );
}

// ==================== SUBMIT ====================
async function submitForm() {
    // Cek jam operasional
    if (!isOperationalHour()) {
        alert('⛔ Maaf, presensi hanya dapat diisi pada pukul 06:45 - 14:00');
        return;
    }
    
    const nama = document.getElementById('nama').value.trim();
    const kelas = document.getElementById('kelas').value;
    const aktivitas = document.getElementById('aktivitas').value;
    
    if (!nama || !kelas || !aktivitas) {
        alert('❌ Harap lengkapi semua data!');
        return;
    }
    
    // Validasi untuk aktivitas yang butuh foto wajah
    if ((aktivitas === 'Absen Masuk' || aktivitas === 'Absen Pulang' || aktivitas === 'Izin') && !capturedPhoto) {
        alert('❌ Harap ambil foto wajah terlebih dahulu!');
        return;
    }
    
    // Validasi upload tugas
    if (aktivitas === 'Upload Tugas' && selectedFiles.length === 0) {
        alert('❌ Harap pilih file tugas!');
        return;
    }
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Mengirim...';
    
    try {
        let tugasDataArray = [];
        
        // Proses upload multiple file
        if (aktivitas === 'Upload Tugas') {
            for (const file of selectedFiles) {
                const compressed = await compressImage(file);
                tugasDataArray.push(compressed);
            }
        }
        
        const data = {
            nama: nama,
            kelas: kelas,
            aktivitas: aktivitas,
            fotoData: capturedPhoto,
            tugasData: tugasDataArray,
            lokasi: currentLocation || { lat: 0, lng: 0, accuracy: 0 },
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };
        
        await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        // Update statistik lokal
        updateLocalStats(kelas, aktivitas);
        
        alert('✅ Data berhasil dikirim!');
        
        // Reset form
        document.getElementById('nama').value = '';
        document.getElementById('kelas').value = '';
        document.getElementById('aktivitas').value = '';
        document.getElementById('fileTugas').value = '';
        document.getElementById('filePreview').innerHTML = '';
        selectedFiles = [];
        
        if (capturedPhoto) {
            retakePhoto();
        }
        
        getLocationOnly();
        
    } catch (error) {
        alert('❌ Gagal mengirim: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📤 KIRIM SEKARANG';
    }
}

// Update statistik lokal
function updateLocalStats(kelas, aktivitas) {
    const today = new Date().toLocaleDateString('id-ID');
    let stats = JSON.parse(localStorage.getItem('presensi_stats_' + today)) || {};
    
    if (!stats[kelas]) {
        stats[kelas] = { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 };
    }
    
    if (aktivitas === 'Absen Masuk') stats[kelas].absenMasuk++;
    else if (aktivitas === 'Absen Pulang') stats[kelas].absenPulang++;
    else if (aktivitas === 'Izin') stats[kelas].izin++;
    else if (aktivitas === 'Upload Tugas') stats[kelas].tugas++;
    
    localStorage.setItem('presensi_stats_' + today, JSON.stringify(stats));
    
    // Refresh tampilan statistik
    loadStatsFromLocal();
}

// Load statistik dari localStorage
function loadStatsFromLocal() {
    const today = new Date().toLocaleDateString('id-ID');
    const stats = JSON.parse(localStorage.getItem('presensi_stats_' + today)) || {};
    
    let totalMasuk = 0, totalPulang = 0, totalIzin = 0, totalTugas = 0;
    const kelasList = ['7a', '7b', '7c', '8a', '8b', '8c'];
    
    for (const kelas of kelasList) {
        const data = stats[kelas] || { absenMasuk: 0, absenPulang: 0, izin: 0, tugas: 0 };
        totalMasuk += data.absenMasuk;
        totalPulang += data.absenPulang;
        totalIzin += data.izin;
        totalTugas += data.tugas;
        
        // Update tampilan per kelas
        const kelasContainer = document.getElementById('kelasStats');
        if (kelasContainer) {
            const items = kelasContainer.querySelectorAll('.kelas-item');
            for (const item of items) {
                const nameSpan = item.querySelector('.kelas-name');
                if (nameSpan && nameSpan.innerText.toUpperCase() === kelas.toUpperCase()) {
                    const countsDiv = item.querySelector('.kelas-counts');
                    if (countsDiv) {
                        countsDiv.innerHTML = `
                            <span>📥 ${data.absenMasuk}</span>
                            <span>🏠 ${data.absenPulang}</span>
                            <span>📝 ${data.izin}</span>
                            <span>📄 ${data.tugas}</span>
                        `;
                    }
                    break;
                }
            }
        }
    }
    
    // Update total
    document.getElementById('totalMasuk').innerText = totalMasuk;
    document.getElementById('totalPulang').innerText = totalPulang;
    document.getElementById('totalIzin').innerText = totalIzin;
    document.getElementById('totalTugas').innerText = totalTugas;
}

function refreshStats() {
    loadStatsFromLocal();
}

// Kompres gambar untuk upload tugas
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Resize jika terlalu besar (max 1024px)
                const maxSize = 1024;
                if (width > maxSize || height > maxSize) {
                    if (width > height) {
                        height = (height * maxSize) / width;
                        width = maxSize;
                    } else {
                        width = (width * maxSize) / height;
                        height = maxSize;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Kompress ke JPEG quality 60%
                const compressed = canvas.toDataURL('image/jpeg', 0.6);
                resolve(compressed);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Fungsi global untuk remove file
window.removeFile = function(index) {
    selectedFiles.splice(index, 1);
    const previewContainer = document.getElementById('filePreview');
    if (previewContainer) {
        previewContainer.innerHTML = '';
        for (let i = 0; i < selectedFiles.length; i++) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const div = document.createElement('div');
                div.className = 'file-preview-item';
                div.innerHTML = `
                    <img src="${e.target.result}">
                    <div class="remove-file" onclick="removeFile(${i})">×</div>
                `;
                previewContainer.appendChild(div);
            };
            reader.readAsDataURL(selectedFiles[i]);
        }
    }
    const fileInput = document.getElementById('fileTugas');
    if (fileInput) {
        const dt = new DataTransfer();
        for (const file of selectedFiles) {
            dt.items.add(file);
        }
        fileInput.files = dt.files;
    }
};
