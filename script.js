// ==================== KONFIGURASI ====================
// GANTI DENGAN URL APPS SCRIPT ANDA!
const API_URL = 'https://script.google.com/macros/s/YOUR_APPS_SCRIPT_ID/exec';

// Variabel global
let currentStream = null;
let capturedPhoto = null;
let currentLocation = null;

// Inisialisasi
document.addEventListener('DOMContentLoaded', function() {
    startCamera();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    getLocationOnly();
    loadStats();
    setInterval(loadStats, 30000);
    
    // Event listeners
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
    
    document.getElementById('captureBtn').addEventListener('click', capturePhoto);
    document.getElementById('retakeBtn').addEventListener('click', retakePhoto);
    document.getElementById('submitBtn').addEventListener('click', submitForm);
});

// Fungsi kamera
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
        
        console.log('Kamera aktif');
        
    } catch (err) {
        console.error('Camera error:', err);
        const videoWrapper = document.querySelector('.video-wrapper');
        let errorMsg = '';
        
        if (err.name === 'NotAllowedError') {
            errorMsg = 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.';
        } else if (err.name === 'NotFoundError') {
            errorMsg = 'Tidak ada kamera yang terdeteksi.';
        } else {
            errorMsg = 'Tidak dapat mengakses kamera: ' + err.message;
        }
        
        videoWrapper.innerHTML = `<div style="color:#333; background:#eee; padding:20px; border-radius:12px; text-align:center;">
            <i class="fas fa-camera-slash" style="font-size:32px; margin-bottom:10px; display:block;"></i>
            ⚠️ ${errorMsg}
        </div>`;
    }
}

function capturePhoto() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    
    if (!video.videoWidth || video.videoWidth === 0) {
        alert('Kamera belum siap. Silakan tunggu.');
        return;
    }
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.8);
    
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = `<img src="${capturedPhoto}" alt="Foto wajah">`;
    
    document.getElementById('video').style.display = 'none';
    document.getElementById('canvas').style.display = 'block';
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'inline-block';
    
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

// GPS - hanya mencatat lokasi
function getLocationOnly() {
    const gpsDiv = document.getElementById('gpsStatus');
    gpsDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengambil lokasi Anda...';
    
    if (!navigator.geolocation) {
        gpsDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Browser tidak mendukung GPS.';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: Math.round(position.coords.accuracy)
            };
            
            gpsDiv.innerHTML = `<i class="fas fa-check-circle"></i> ✅ Lokasi tercatat!
                <br><small>📌 ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}</small>
                <br><small>📍 Akurasi: ${currentLocation.accuracy} meter</small>`;
            gpsDiv.className = 'gps-status gps-success';
        },
        function(error) {
            let errorMsg = '';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Izin lokasi ditolak.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Lokasi tidak tersedia.';
                    break;
                default:
                    errorMsg = 'Gagal mengambil lokasi.';
            }
            gpsDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ⚠️ ${errorMsg}`;
            gpsDiv.className = 'gps-status gps-error';
            currentLocation = { lat: 0, lng: 0, accuracy: 0 };
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// Submit ke Apps Script
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
        
        // Karena mode 'no-cors', kita tidak bisa membaca response
        // Tapi data tetap terkirim
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

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// DateTime
function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').innerHTML = now.toLocaleDateString('id-ID', options);
    document.getElementById('time').innerHTML = now.toLocaleTimeString('id-ID');
}

// Load stats dari Apps Script
async function loadStats() {
    try {
        const response = await fetch(`${API_URL}?action=getStats`);
        // Karena mode no-cors, kita perlu cara lain
        // Untuk sementara, stats tidak auto-refresh
        console.log('Stats loading...');
    } catch (error) {
        console.error('Stats error:', error);
    }
}

// Alternative: Panggil langsung dari Google Sheet via Apps Script Web App
async function loadStatsFromSheet() {
    // Bisa menggunakan Google Sheets API atau endpoint terpisah
    console.log('Silakan setup endpoint statistik terpisah');
}