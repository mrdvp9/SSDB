function login() {
    var user = document.getElementById('username').value;
    var pass = document.getElementById('password').value;

    if (user === "team_tcjd" && pass === "6789") {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('app').classList.remove('hidden');
    } else {
        document.getElementById('loginError').textContent = "Invalid username or password";
    }
}

var otpHistory = {
    food: [],
    package: []
};

var accessLogs = [];
var isLockedOut = false;
var millisOffset = null;
var lastLogCount = 0;   // ✅ for notifications

var DRIVE_FOLDER_ID = '1jghyPM951sBjU54vo8-MsDgpvIahOC0R';
var GOOGLE_API_KEY  = 'AIzaSyDAk8rFYA849BMEo2UJ8Gg3b45lBgtg888';
var ESP32_IP = '10.199.21.50';  
//var ESP32_IP = 'esp32.local';

/*>>> showPage ===============================================================*/
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.add('hidden');
    });

    document.getElementById(pageId).classList.remove('hidden');

    if (pageId === 'page2') fetchAccessLogs();
    if (pageId === 'page3') updateHistoryDisplay();
    if (pageId === 'page4') loadPhotos();
}

/*>>> generateOTP ============================================================*/
function generateOTP(type) {
    if (isLockedOut) {
        alert('System is locked out!');
        return;
    }

    var otp = Math.floor(1000 + Math.random() * 9000);
    var timestamp = new Date();

    otpHistory[type].push({ code: otp, time: timestamp });

    // ✅ SHOW IN UI (NOT ALERT)
    var box = document.getElementById('otpDisplayBox');
    box.textContent = type.toUpperCase() + " OTP: " + otp;
    box.classList.remove('hidden');

    // hide after 3 sec
    setTimeout(function() {
        box.classList.add('hidden');
    }, 3000);

    sendOTPtoESP32(otp, type);
    updateHistoryDisplay();
}

/*>>> sendOTPtoESP32 =========================================================*/
function sendOTPtoESP32(otp, type) {
    var url = 'http://' + ESP32_IP + '/otp?code=' + otp + '&type=' + type;

    fetch(url).catch(function(error) {
        console.error('Error sending OTP:', error);
    });
}

/*>>> toggleLockout (FIXED) ==================================================*/
function toggleLockout() {
    isLockedOut = !isLockedOut;

    var status1 = document.getElementById('lockStatus');
    var status2 = document.getElementById('lockStatusPage2');
    var btnElement = document.getElementById('lockBtn');

    if (isLockedOut) {
        if (status1) {
            status1.textContent = 'LOCKED';
            status1.classList.add('locked');
        }
        if (status2) {
            status2.textContent = 'LOCKED';
            status2.classList.add('locked');
        }
        if (btnElement) btnElement.textContent = 'Unlock';

        fetch('http://' + ESP32_IP + '/lockout?state=1');

    } else {
        if (status1) {
            status1.textContent = 'NORMAL';
            status1.classList.remove('locked');
        }
        if (status2) {
            status2.textContent = 'NORMAL';
            status2.classList.remove('locked');
        }
        if (btnElement) btnElement.textContent = 'Lockout';

        fetch('http://' + ESP32_IP + '/lockout?state=0');
    }
}

/*>>> changeMasterPassword ===================================================*/
function changeMasterPassword() {
    if (isLockedOut) {
        alert('System is locked out!');
        return;
    }

    var pass = document.getElementById('newMasterPass').value.trim();

    if (pass.length === 0) {
        alert('Please enter a password');
        return;
    }

    var url = 'http://' + ESP32_IP + '/changepass?newpass=' + pass;

    fetch(url)
        .then(function() {
            alert('Master password updated');
            document.getElementById('newMasterPass').value = '';
        })
        .catch(function() {
            alert('Failed to update password');
        });
}

/*>>> DELIVERY NOTIFICATIONS =================================================*/
function showDeliveryNotification(type) {
    if (Notification.permission === 'granted') {
        var message = (type.toLowerCase() === 'food')
            ? 'Food is delivered'
            : 'Package is delivered';

        new Notification('Delivery Box', {
            body: message
        });
    }
}

/*>>> loadPhotos =============================================================*/
function loadPhotos() {
    var gallery = document.getElementById('photoGallery');
    gallery.innerHTML = '<div class="loading">Loading photos...</div>';

    if (DRIVE_FOLDER_ID && GOOGLE_API_KEY) {
        loadFromGoogleDrive();
    }
}

/*>>> loadFromGoogleDrive ====================================================*/
function loadFromGoogleDrive() {
    var url = 'https://www.googleapis.com/drive/v3/files?q="' + DRIVE_FOLDER_ID
        + '"+in+parents+and+mimeType+contains+"image/"&key=' + GOOGLE_API_KEY
        + '&fields=files(id,name,createdTime,thumbnailLink)&orderBy=createdTime desc';

    fetch(url)
        .then(res => res.json())
        .then(data => displayPhotos(data.files));
}

/*>>> displayPhotos ==========================================================*/
function displayPhotos(files) {
    var gallery = document.getElementById('photoGallery');
    gallery.innerHTML = '';

    if (!files || files.length === 0) {
        gallery.innerHTML = '<div class="empty-state">No photos</div>';
        return;
    }

    files.forEach(function(file) {

        // 🔥 Parse message like: $PIC,Food,1234,CS
        var meta = parsePIC(file.name);

        var item = document.createElement('div');
        item.className = 'photo-card';

        item.innerHTML =
            '<img src="' + file.thumbnailLink + '">' +
            ''

        item.onclick = function() {
            openPhotoModal(
                file.thumbnailLink.replace('=s220', '=s800'),
                meta,
                file.createdTime
            );
        };

        gallery.appendChild(item);
    });
}

function parsePIC(name) {
    try {
        if (!name.startsWith('$PIC')) {
            return { type: 'Unknown', otp: '----' };
        }

        var parts = name.split(',');

        return {
            type: parts[1] || 'Unknown',
            otp: parts[2] || '----'
        };

    } catch (e) {
        return { type: 'Unknown', otp: '----' };
    }
}

function openPhotoModal(imageUrl, meta, createdTime) {
    var modal = document.getElementById('photoModal');
    var img = document.getElementById('modalImage');
    var info = document.getElementById('photoInfo');

    img.src = imageUrl;

    var time = new Date(createdTime).toLocaleString();

    info.innerHTML =
        '<div><b>Type:</b> ' + meta.type + '</div>' +
        '<div><b>OTP:</b> ' + meta.otp + '</div>' +
        '<div><b>Time:</b> ' + time + '</div>';

    modal.classList.remove('hidden');
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.add('hidden');
}

/*>>> fetchAccessLogs (UPDATED WITH NOTIFICATIONS) ===========================*/
function fetchAccessLogs() {
    fetch('http://' + ESP32_IP + '/getlogs')
        .then(res => res.json())
        .then(function(data) {

            var newLogs = Array.isArray(data) ? data : [];

            if (millisOffset === null && newLogs.length > 0) {
            var latestMs = newLogs[newLogs.length - 1].timestamp;
            millisOffset = Date.now() - latestMs;
}

            // ✅ detect new logs
            if (newLogs.length > lastLogCount) {
                for (var i = lastLogCount; i < newLogs.length; i++) {
                    showDeliveryNotification(newLogs[i].type);
                }
            }

            lastLogCount = newLogs.length;
            accessLogs = newLogs;

            displayAccessLogs();
            updateDashboardRecentAccess();
        });
}

/*>>> displayAccessLogs ======================================================*/
function displayAccessLogs() {
    var container = document.getElementById('historyList');
    if (!container) return;

    container.innerHTML = '';

    accessLogs.slice().reverse().forEach(function(log) {
        var row = document.createElement('div');
        row.className = 'history-row';
        row.innerHTML =
            '<div><div class="name">' + log.type + '</div>' +
            '<div class="method">OTP: ' + log.otp + '</div></div>' +
            '<div class="date">' + formatTime(log.timestamp) + '</div>';
        container.appendChild(row);
    });
}

/*>>> updateDashboardRecentAccess ===========================================*/
function updateDashboardRecentAccess() {
    var container = document.getElementById('recentAccessList');
    if (!container) return;

    container.innerHTML = '';

    accessLogs.slice(-2).reverse().forEach(function(log) {
        var row = document.createElement('div');
        row.className = 'access-row';
        row.innerHTML =
            '<span class="name">' + log.type + '</span>' +
            '<span class="time">' + formatTime(log.timestamp) + '</span>';
        container.appendChild(row);
    });
}

/*>>> formatTime =============================================================*/
function formatTime(ts) {
    var realMs = (millisOffset !== null) ? (millisOffset + ts) : Date.now();
    var d = new Date(realMs);
    var diff = Math.floor((Date.now() - realMs) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' mins ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';

    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

/*>>> initApp ================================================================*/
function initApp() {

    // ✅ request notification permission
    if ('Notification' in window) {
        Notification.requestPermission();
    }

    fetchAccessLogs();

    setInterval(function() {
        fetchAccessLogs();
    }, 5000);
}

var pages = ['page1', 'page2', 'page3', 'page4'];
var currentPageIndex = 0;

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.add('hidden');
    });

    document.getElementById(pageId).classList.remove('hidden');

    currentPageIndex = pages.indexOf(pageId);

    if (pageId === 'page2') fetchAccessLogs();
    if (pageId === 'page3') updateHistoryDisplay();
    if (pageId === 'page4') loadPhotos();
}

function nextPage() {
    if (currentPageIndex < pages.length - 1) {
        currentPageIndex++;
        showPage(pages[currentPageIndex]);
    }
}

function prevPage() {
    if (currentPageIndex > 0) {
        currentPageIndex--;
        showPage(pages[currentPageIndex]);
    }
}

function openOTPMenu() {
    document.getElementById('otpMainMenu').classList.add('hidden');
    document.getElementById('otpSubMenu').classList.remove('hidden');
}

function showOTPHistory() {
    document.getElementById('otpMainMenu').classList.add('hidden');
    document.getElementById('otpHistoryMenu').classList.remove('hidden');

    updateHistoryDisplay();
}

function goBackToMainOTP() {
    document.getElementById('otpSubMenu').classList.add('hidden');
    document.getElementById('otpHistoryMenu').classList.add('hidden');
    document.getElementById('otpMainMenu').classList.remove('hidden');
}

function updateHistoryDisplay() {
    var foodContainer = document.getElementById('foodHistory');
    var packageContainer = document.getElementById('packageHistory');

    if (foodContainer) {
        foodContainer.innerHTML = '';
        otpHistory.food.slice().reverse().forEach(function(item) {
            foodContainer.innerHTML +=
                '<div class="otp-history-item">OTP: ' + item.code +
                ' <span class="otp-time">' + new Date(item.time).toLocaleTimeString() +
                '</span></div>';
        });
    }

    if (packageContainer) {
        packageContainer.innerHTML = '';
        otpHistory.package.slice().reverse().forEach(function(item) {
            packageContainer.innerHTML +=
                '<div class="otp-history-item">OTP: ' + item.code +
                ' <span class="otp-time">' + new Date(item.time).toLocaleTimeString() +
                '</span></div>';
        });
    }
}

function clearAccessLogs(event) {
    event.stopPropagation();
    fetch('http://' + ESP32_IP + '/clearlogs')
        .then(function() {
            accessLogs = [];
            lastLogCount = 0;
            displayAccessLogs();
            updateDashboardRecentAccess();
        });
}


document.addEventListener('DOMContentLoaded', initApp);