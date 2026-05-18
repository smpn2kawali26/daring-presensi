// ==================== KONFIGURASI ====================
const API_URL = 'https://script.google.com/macros/s/AKfycbxcw0J59ojWkJxQJKRgn8UmNLHee1qwyAmMCR3oU2DmveaqjHDXP8_lryRlJV0cJrljBQ/exec';

let currentStream = null;
let capturedPhoto = null;
let currentLocation = null;
let currentFacingMode = 'user';
let selectedFiles = [];

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
        } else if (aktivitas === 'Absen Masuk' || aktivitas === 'Absen Pulang' || aktivitas === 'Izin' || aktivitas === 'Sakit') {
            cameraSection.style.display = 'block';
            cameraSelectGroup.style.display = 'block';
            uploadGroup.style.display = 'none';
            startCamera();
        } else {
            cameraSection.style.display = 'none';
            cameraSelectGroup.style.display = 'none';
            uploadGroup.style.display = 'none';
        }
        
        // Reset warning
        document.getElementById('cameraWarning').style.display = 'none';
        document.getElementById('fileWarning').style.display = 'none';
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
    
    // Load statistik dari localStorage
    loadStatsFromLocal();
    
    // Refresh statistik setiap 30 detik
    setInterval(refreshStats, 30000);
});

// ==================== VALIDASI WAKTU PER AKTIVITAS ====================
function isActivityAllowed(aktivitas) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    let startTime, endTime;
    
    switch(aktivitas) {
        case 'Absen Masuk':
            startTime = 6 * 60;      // 06:00
            endTime = 8 * 60;        // 08:00
            break;
        case 'Absen Pulang':
            startTime = 11 * 60;     // 11:00
            endTime = 14 * 60;       // 14:00
            break;
        case 'Izin':
        case 'Sakit':
            startTime = 6 * 60;      // 06:00
            endTime = 14 * 60;       // 14:00
            break;
        case 'Upload Tugas':
            startTime = 6 * 60;      // 06:00
            endTime = 15 * 60;       // 15:00
            break;
        default:
            return false;
    }
    
    return currentTime >= startTime && currentTime <= endTime;
}

function getTimeRemaining(aktivitas) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentTime = hours * 60 + minutes;
    
    let endTime;
    switch(aktivitas) {
        case 'Absen Masuk': endTime = 8 * 60; break;
        case 'Absen Pulang': endTime = 14 * 60; break;
        case 'Izin':
        case 'Sakit': endTime = 14 * 60; break;
        case 'Upload Tugas': endTime = 15 * 60; break;
        default: return 0;
    }
    
    const remaining = endTime - currentTime;
    if (remaining <= 0) return 0;
    
    const hoursRemaining = Math.floor(remaining / 60);
    const minutesRemaining = remaining % 60;
    
    if (hoursRemaining > 0) {
        return `${hoursRemaining} jam ${minutesRemaining} menit`;
    }
    return `${minutesRemaining} menit`;
}

function updateDateTime() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').innerHTML = now.toLocaleDateString('id-ID', options);
    document.getElementById('time').innerHTML = now.toLocaleTimeString('id-ID');
    
    const statusDiv = document.getElementById('statusJam');
    const aktivitas = document.getElementById('aktivitas').value;
    
    if (aktivitas && aktivitas !== '') {
        if (isActivityAllowed(aktivitas)) {
            const remaining = getTimeRemaining(aktivitas);
            statusDiv.innerHTML = `✅ Waktu tersedia: ${remaining} lagi`;
            statusDiv.className = 'jam-status open';
        } else {
            statusDiv.innerHTML = `⛔ Waktu untuk ${aktivitas} sudah habis!`;
            statusDiv.className = 'jam-status closed';
        }
    } else {
        statusDiv.innerHTML = '📅 Pilih aktivitas terlebih dahulu';
        statusDiv.className = 'jam-status warning';
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
        
        document.getElementById('video').style.display = 'block';
        document.getElementById('canvas').style.display = 'none';
        document.getElementById('captureBtn').style.display = 'inline-block';
        document.getElementById('retakeBtn').style.display = 'none';
        document.getElementById('photoPreview').innerHTML = '';
        capturedPhoto = null;
        document.getElementById('cameraWarning').style.display = 'none';
        
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
    
    if (!video.videoWidth || video.videoWidth === 0) {
        alert('Kamera belum siap. Silakan tunggu.');
        return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    capturedPhoto = canvas.toDataURL('image/jpeg', 0.5);
    
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = `<img src="${capturedPhoto}" alt="Foto">`;
    
    video.style.display = 'none';
    canvas.style.display = 'block';
    document.getElementById('captureBtn').style.display = 'none';
    document.getElementById('retakeBtn').style.display = 'inline-block';
    document.getElementById('cameraWarning').style.display = 'none';
    
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
    
    document.getElementById('fileWarning').style.display = 'none';
}

function removeFile(index) {
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
