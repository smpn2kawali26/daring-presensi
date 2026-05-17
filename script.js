// ==================== KONFIGURASI ====================
// URL Apps Script Anda
const API_URL = 'https://script.google.com/macros/s/AKfycbxcw0J59ojWkJxQJKRgn8UmNLHee1qwyAmMCR3oU2DmveaqjHDXP8_lryRlJV0cJrljBQ/exec';

// Variabel global
let currentStream = null;
let capturedPhoto = null;
let currentLocation = null;

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', function() {
    startCamera();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    getLocationOnly();
    loadStats();
    setInterval(loadStats, 30000);
    
    // Event listener untuk aktivitas
    document.getElementById('aktivitas').addEventListener('change', function() {
        const uploadGroup = document.getElementById('uploadTugasGroup');
        const cameraSection = document.getElementById('cameraSection');
        
        if (this.value === 'Upload Tugas') {
            uploadGroup.style.display = 'block';
            cameraSection.style.display = 'block';
        } else if (this.value === 'Absen Masuk' || this.value === 'Absen Pulang') {
            uploadGroup.style.display = 'none';
            cameraSection.style.display = 'block';
        } else {
            uploadGroup.style.display = 'none';
            cameraSection.style.display = 'block';
        }
    });
    
    // Event listener tombol
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);
    document.getElementById('retakeBtn').addEventListener('click', retakePhoto);
    document.getElementById('submitBtn').addEventListener('click', submitForm);
});

// ==================== FUNGSI KAMERA ====================
async function startCamera() {
    try {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('video');
        video.srcObject = currentStream;
        video.setAttribute('playsinline', true);
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });
        
        console.log('Kamera berhasil diaktifkan');
        
    } catch (err) {
        console.error('Camera error:', err);
        const videoWrapper = document.querySelector('.video-wrapper');
        let errorMsg = '';
        
        if (err.name === 'NotAllowedError') {
            errorMsg = 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.';
        } else if (err.name === 'NotFoundError') {
            errorMsg = 'Tidak ada kamera yang terdeteksi di perangkat ini.';
        } else if (err.name === 'NotReadableError') {
            errorMsg = 'Kamera sedang digunakan oleh aplikasi lain.';
        } else {
            errorMsg = 'Tidak dapat mengakses kamera: ' + err.message;
        }
        
        if (videoWrapper) {
            videoWrapper.innerHTML = `<div style="padding:20px; background:#eee; border-radius:12px; text-align:center;">
                <i class="fas fa-camera-slash" style="font-size:32px; margin-bottom:10px; display:block;"></i>
                ⚠️ ${errorMsg}<br><small>Pastikan Anda memberikan izin kamera saat diminta browser.</small>
            </div>`;
        }
    }
}

function capturePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    if (!video.videoWidth || video.videoWidth === 0) {
        alert('Kamera belum siap. Silakan tunggu atau refresh halaman.');
        return;
    }
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);
    
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = `<img src="${capturedPhoto}" alt="Foto wajah" style="width:100%; max-width:200px; border-radius:12px; border:3px solid #667eea;">`;
    
    document.getElementById('video').style.display = 'none';
    document.getElementById('canvas').style.display = 'block';
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'inline-block';
    
    // Matikan stream kamera untuk hemat baterai
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

function retakePhoto() {
    capturedPhoto = null;
    document.getElementById('video').style.display = 'block';
    document.getElementById('canvas').style.display = 'none';
    document.getElementById('captureBtn').style.display = 'inline-block';
    document.getElementById('retakeBtn').style.display = 'none';
    document.getElementById('photoPreview').innerHTML = '';
    startCamera();
}

// ==================== FUNGSI GPS (Hanya Mencatat) ====================
function getLocationOnly() {
    const gpsDiv = document.getElementById('gpsStatus');
    if (!gpsDiv) return;
    
    gpsDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengambil lokasi Anda...';
    
    if (!navigator.geolocation) {
        gpsDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Browser tidak mendukung GPS. Lokasi tidak akan tercatat.';
        gpsDiv.className = 'gps-status gps-warning';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: Math.round(position.coords.accuracy)
            };
            
            gpsDiv.innerHTML = `<i class="fas fa-check-circle"></i> ✅ Lokasi berhasil dicatat!
                <br><small>📌 ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}</small>
                <br><small>📍 Akurasi: ${currentLocation.accuracy} meter</small>`;
            gpsDiv.className = 'gps-status gps-success';
        },
        function(error) {
            let errorMsg = '';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Izin lokasi ditolak. Lokasi tidak akan tercatat.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Lokasi tidak tersedia.';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Waktu pengambilan lokasi habis.';
                    break;
                default:
                    errorMsg = 'Gagal mengambil lokasi.';
            }
            gpsDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ⚠️ ${errorMsg}
                <br><small>Absen tetap bisa dilakukan, namun lokasi tidak akan tercatat.</small>`;
            gpsDiv.className = 'gps-status gps-error';
            currentLocation = { lat: 0, lng: 0, accuracy: 0 };
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

// ==================== FUNGSI SUBMIT ====================
async function submitForm() {
    const nama = document.getElementById('nama').value.trim();
    const kelas = document.getElementById('kelas').value;
    const aktivitas = document.getElementById('aktivitas').value;
    
    if (!nama || !kelas || !aktivitas) {
        alert('❌ Harap lengkapi semua data!');
        return;
    }
    
    if ((aktivitas === 'Absen Masuk' || aktivitas === 'Absen Pulang') && !capturedPhoto) {
        alert('❌ Harap ambil foto wajah terlebih dahulu!');
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengirim...';
    
    let tugasData = null;
    if (aktivitas === 'Upload Tugas') {
        const fileInput = document.getElementById('fileTugas');
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert('❌ File terlalu besar! Maksimal 2MB');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> KIRIM SEKARANG';
                return;
            }
            tugasData = await fileToBase64(file);
        } else {
            alert('❌ Harap pilih file tugas!');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> KIRIM SEKARANG';
            return;
        }
    }
    
    const data = {
        nama: nama,
        kelas: kelas,
        aktivitas: aktivitas,
        fotoData: capturedPhoto,
        tugasData: tugasData,
        lokasi: currentLocation || { lat: 0, lng: 0, accuracy: 0 },
        userAgent: navigator.userAgent
    };
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        alert('✅ Data berhasil dikirim!');
        
        // Reset form
        document.getElementById('nama').value = '';
        document.getElementById('kelas').value = '';
        document.getElementById('aktivitas').value = '';
        document.getElementById('fileTugas').value = '';
        if (capturedPhoto) {
            retakePhoto();
        }
        loadStats();
        getLocationOnly();
        
    } catch (error) {
        alert('❌ Gagal mengirim: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> KIRIM SEKARANG';
    }
}

// Helper: Convert file ke base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==================== FUNGSI WAKTU ====================
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateElement = document.getElementById('date');
    const timeElement = document.getElementById('time');
    
    if (dateElement) dateElement.innerHTML = now.toLocaleDateString('id-ID', options);
    if (timeElement) timeElement.innerHTML = now.toLocaleTimeString('id-ID');
}

// ==================== FUNGSI STATISTIK ====================
async function loadStats() {
    try {
        // Panggil API untuk mendapatkan statistik
        const response = await fetch(`${API_URL}?action=getStats`);
        // Karena mode no-cors, kita tidak bisa membaca response
        // Tampilkan data statistik dari sheet langsung
        console.log('Memuat statistik...');
        
        // Tampilkan data contoh (nanti akan diupdate dari Apps Script)
        updateKelasStats({
            '7a': { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 },
            '7b': { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 },
            '7c': { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 },
            '8a': { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 },
            '8b': { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 },
            '8c': { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 }
        });
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function updateKelasStats(kelasStats) {
    const container = document.getElementById('kelasStats');
    if (!container) return;
    
    container.innerHTML = '';
    const kelasList = ['7a', '7b', '7c', '8a', '8b', '8c'];
    
    for (const kelas of kelasList) {
        const data = kelasStats[kelas] || { absenMasuk: 0, absenPulang: 0, uploadTugas: 0 };
        const div = document.createElement('div');
        div.className = 'kelas-item';
        div.innerHTML = `
            <span class="kelas-name">${kelas.toUpperCase()}</span>
            <div class="kelas-counts">
                <span>📥 ${data.absenMasuk}</span>
                <span>🏠 ${data.absenPulang}</span>
                <span>📄 ${data.uploadTugas}</span>
            </div>
        `;
        container.appendChild(div);
    }
}

// ==================== LOGO ====================
// Logo dari Google Drive
const logoImg = document.getElementById('logoImg');
if (logoImg) {
    logoImg.src = 'https://drive.google.com/uc?export=view&id=1nlVZtT1OQJKcX61ylMOkufbIE9x2MK6k';
}
