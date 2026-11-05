// ==================== DATA STORE (Supabase Cloud Database & Offline Cache) ====================

const SUPABASE_URL = 'https://xkxcubwgljzkjaairidj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wH-uJCgIb7EUJfAJy6kmWQ_VnSFGtCF';

const DB = {
    // In-memory cache for snappy rendering
    _wishes: null,

    async fetchWishes() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/wishes?select=*&order=created_at.desc`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                this._wishes = data.map(item => ({
                    id: String(item.id),
                    name: item.name,
                    attendance: item.attendance || 'hadir',
                    guests: item.guests || 1,
                    message: item.message,
                    timestamp: item.created_at
                }));
                localStorage.setItem('wedding_wishes', JSON.stringify(this._wishes));
                return this._wishes;
            }
        } catch (e) {
            console.warn('Supabase offline, fallback to localStorage', e);
        }
        return this.getWishes();
    },

    getWishes() {
        if (this._wishes !== null) return this._wishes;
        const stored = localStorage.getItem('wedding_wishes');
        if (stored) {
            try {
                this._wishes = JSON.parse(stored);
                return this._wishes;
            } catch {
                this._wishes = [];
                return [];
            }
        }
        this._wishes = [];
        return [];
    },

    async saveWish(wish) {
        // Optimistic UI update
        const wishes = this.getWishes();
        wishes.unshift(wish);
        this._wishes = wishes;
        localStorage.setItem('wedding_wishes', JSON.stringify(wishes));

        // Save directly to Supabase PostgreSQL table
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/wishes`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    name: wish.name,
                    message: wish.message,
                    attendance: wish.attendance,
                    guests: wish.guests || 1
                })
            });
        } catch (e) {
            console.warn('Gagal simpan ke Supabase:', e);
        }
    },

    async deleteWish(id) {
        const wishes = this.getWishes().filter(w => String(w.id) !== String(id));
        this._wishes = wishes;
        localStorage.setItem('wedding_wishes', JSON.stringify(wishes));

        try {
            await fetch(`${SUPABASE_URL}/rest/v1/wishes?id=eq.${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
        } catch (e) {
            console.warn('Gagal hapus di Supabase:', e);
        }
    },

    getRSVPs() {
        const stored = localStorage.getItem('wedding_rsvps');
        if (stored) {
            try { return JSON.parse(stored); } catch { return []; }
        }
        return [];
    },
    saveRSVP(rsvp) {
        const rsvps = this.getRSVPs();
        rsvps.unshift(rsvp);
        localStorage.setItem('wedding_rsvps', JSON.stringify(rsvps));
    },
    deleteRSVP(id) {
        const rsvps = this.getRSVPs().filter(r => r.id !== id);
        localStorage.setItem('wedding_rsvps', JSON.stringify(rsvps));
    },

    getGifts() {
        return JSON.parse(localStorage.getItem('wedding_gifts') || '[]');
    },
    saveGift(gift) {
        const gifts = this.getGifts();
        gifts.unshift(gift);
        localStorage.setItem('wedding_gifts', JSON.stringify(gifts));
    },
    deleteGift(id) {
        const gifts = this.getGifts().filter(g => g.id !== id);
        localStorage.setItem('wedding_gifts', JSON.stringify(gifts));
    },

    getMessages() {
        return JSON.parse(localStorage.getItem('wedding_messages') || '[]');
    },
    saveMessage(msg) {
        const msgs = this.getMessages();
        msgs.unshift(msg);
        localStorage.setItem('wedding_messages', JSON.stringify(msgs));
    }
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Initialize AOS
    if (window.AOS) {
        AOS.init({
            duration: 800,
            easing: 'ease-out-cubic',
            once: true,
            offset: 50,
        });
    }
    
    // Get guest name from URL
    const urlParams = new URLSearchParams(window.location.search);
    const guestName = urlParams.get('to') || urlParams.get('nama');
    if (guestName) {
        const nameText = decodeURIComponent(guestName);
        const guestEl = document.getElementById('guest-name');
        if (guestEl) guestEl.textContent = nameText;
        
        const formNameEl = document.getElementById('rsvp-wish-name');
        if (formNameEl) formNameEl.value = nameText;
    }
    
    // Start countdown
    startCountdown();
    
    // Render existing wishes (marquee bergulir ke kiri)
    renderWishes();
    DB.fetchWishes().then(() => renderWishes());
    
    // Create sparkle particles on cover
    createSparkles();
    
    // Start floating petals
    startPetals();
    
    // Setup bottom nav active state listener
    setupBottomNav();
});

// ==================== COVER / OPENING ====================

function openInvitation() {
    const cover = document.getElementById('cover');
    const mainContent = document.getElementById('main-content');
    const bottomNav = document.getElementById('bottom-nav');
    
    cover.classList.add('hidden-cover');
    
    setTimeout(() => {
        cover.style.display = 'none';
        mainContent.classList.remove('opacity-0');
        mainContent.style.opacity = '1';
        
        if (bottomNav) {
            bottomNav.classList.remove('translate-y-32');
            bottomNav.classList.add('translate-y-0');
        }
        
        // Refresh AOS & Lucide
        if (window.AOS) AOS.refresh();
        if (window.lucide) lucide.createIcons();
        
        // Auto play music
        const music = document.getElementById('bg-music');
        if (music) {
            if (music.currentTime < 10) {
                music.currentTime = 10;
            }
            music.play().then(() => {
                updateMusicIcon(true);
            }).catch(() => {
                // Auto-play was prevented by browser policy
                updateMusicIcon(false);
            });
        }
    }, 600);
}

// ==================== MUSIC ====================

let isMusicPlaying = false;

function toggleMusic() {
    const music = document.getElementById('bg-music');
    if (!music) return;
    
    if (isMusicPlaying) {
        music.pause();
        updateMusicIcon(false);
    } else {
        if (music.currentTime < 10) {
            music.currentTime = 10;
        }
        music.play().then(() => {
            updateMusicIcon(true);
        }).catch(() => {});
    }
}

function updateMusicIcon(playing) {
    isMusicPlaying = playing;
    const onIcon = document.getElementById('music-icon-on');
    const offIcon = document.getElementById('music-icon-off');
    if (onIcon && offIcon) {
        onIcon.style.display = playing ? 'block' : 'none';
        offIcon.style.display = playing ? 'none' : 'block';
    }
}

// ==================== COUNTDOWN ====================

function startCountdown() {
    const weddingDate = new Date('2027-01-08T09:00:00+07:00').getTime();
    
    function update() {
        const now = new Date().getTime();
        const diff = weddingDate - now;
        
        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            ['', '-mid'].forEach(suffix => {
                animateNumber('countdown-days' + suffix, days);
                animateNumber('countdown-hours' + suffix, hours);
                animateNumber('countdown-minutes' + suffix, minutes);
                animateNumber('countdown-seconds' + suffix, seconds);
            });
        } else {
            ['', '-mid'].forEach(suffix => {
                ['countdown-days', 'countdown-hours', 'countdown-minutes', 'countdown-seconds'].forEach(id => {
                    const el = document.getElementById(id + suffix);
                    if (el) el.textContent = '00';
                });
            });
        }
    }
    
    update();
    setInterval(update, 1000);
}

function animateNumber(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const formatted = String(value).padStart(2, '0');
    if (el.textContent !== formatted) {
        el.textContent = formatted;
    }
}

// ==================== BOTTOM NAVIGATION ====================

function setupBottomNav() {
    const navItems = document.querySelectorAll('.bottom-nav-item');
    const sections = [
        { id: 'home', nav: 'nav-home' },
        { id: 'event', nav: 'nav-event' },
        { id: 'gallery', nav: 'nav-gallery' },
        { id: 'wishes', nav: 'nav-wishes' },
    ];
    
    window.addEventListener('scroll', () => {
        let currentSectionId = 'home';
        const scrollPosition = window.scrollY + window.innerHeight * 0.35;
        
        sections.forEach(sec => {
            const el = document.getElementById(sec.id);
            if (el && scrollPosition >= el.offsetTop) {
                currentSectionId = sec.id;
            }
        });
        
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('data-target') === currentSectionId) {
                item.classList.add('active');
            }
        });
    });
}

function scrollToSection(targetId) {
    const el = document.getElementById(targetId);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ==================== GALLERY & LIGHTBOX ====================

const galleryImages = [
    'assets/images/isdul_here.png',
    'assets/images/isdul_1.jpeg',
    'assets/images/isdul_2.jpeg',
    'assets/images/isdul_3.jpeg',
    'assets/images/idul_4.jpeg',
    'assets/images/adul.jpeg',
    'assets/images/isla.jpeg',
];

let currentImageIndex = 0;

function openLightbox(index) {
    currentImageIndex = index;
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lightbox || !img) return;
    
    img.src = galleryImages[index];
    lightbox.classList.remove('hidden');
    lightbox.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeLightbox(event) {
    if (event) event.stopPropagation();
    const lightbox = document.getElementById('lightbox');
    if (!lightbox) return;
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
    document.body.style.overflow = '';
}

function nextImage(event) {
    if (event) event.stopPropagation();
    currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
    document.getElementById('lightbox-img').src = galleryImages[currentImageIndex];
}

function prevImage(event) {
    if (event) event.stopPropagation();
    currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
    document.getElementById('lightbox-img').src = galleryImages[currentImageIndex];
}

document.addEventListener('keydown', (e) => {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && !lightbox.classList.contains('hidden')) {
        if (e.key === 'Escape') closeLightbox(e);
        if (e.key === 'ArrowRight') nextImage(e);
        if (e.key === 'ArrowLeft') prevImage(e);
    }
});

// ==================== COMBINED RSVP & WISHES ====================

function submitRsvpWish(e) {
    e.preventDefault();
    
    const nameEl = document.getElementById('rsvp-wish-name');
    const attendanceEl = document.querySelector('input[name="attendance"]:checked');
    const messageEl = document.getElementById('rsvp-wish-message');
    
    const name = nameEl ? nameEl.value.trim() : '';
    const attendance = attendanceEl ? attendanceEl.value : 'hadir';
    const guests = attendance === 'hadir' ? 1 : 0;
    const message = messageEl ? messageEl.value.trim() : '';
    
    if (!name || !message) {
        showToast('Mohon lengkapi nama dan doa ucapan Anda 🙏');
        return;
    }
    
    const nowIso = new Date().toISOString();
    
    // Save to Wishes DB
    const wishItem = {
        id: Date.now().toString(),
        name,
        attendance,
        guests,
        message,
        timestamp: nowIso,
    };
    DB.saveWish(wishItem);
    
    // Save to RSVP DB
    const rsvpItem = {
        id: (Date.now() + 1).toString(),
        name,
        attendance,
        guests,
        timestamp: nowIso,
    };
    DB.saveRSVP(rsvpItem);
    
    // Save to Unified Messages history (compatible with admin dashboard filters)
    DB.saveMessage({
        id: (Date.now() + 2).toString(),
        type: 'wish',
        name,
        content: message,
        timestamp: nowIso,
    });
    DB.saveMessage({
        id: (Date.now() + 3).toString(),
        type: 'rsvp',
        name,
        content: attendance === 'hadir' ? 'Konfirmasi: Akan Hadir' : 'Konfirmasi: Berhalangan Hadir',
        timestamp: nowIso,
    });
    
    // Re-render wishes marquee
    renderWishes();
    
    // Clear inputs (keep name for ease of use)
    if (messageEl) messageEl.value = '';
    
    showToast(attendance === 'hadir' 
        ? 'Terima kasih atas doa & konfirmasi kehadiran Anda! 💕' 
        : 'Terima kasih atas doa restunya, salam hangat! 🙏');
}

function renderWishes() {
    const marqueeContainer = document.getElementById('wishes-marquee-track');
    const countEl = document.getElementById('wish-count');
    const wishes = DB.getWishes();
    
    if (countEl) {
        countEl.textContent = `${wishes.length} Ucapan & Doa`;
    }
    
    if (!marqueeContainer) return;
    
    if (wishes.length === 0) {
        marqueeContainer.innerHTML = `
            <div class="px-6 py-4 bg-white/80 rounded-2xl border border-gold-200 text-royal-700 text-sm">
                Belum ada ucapan. Jadilah yang pertama memberikan doa restu!
            </div>
        `;
        return;
    }
    
    const cardHtml = (wish) => {
        const isHadir = wish.attendance === 'hadir';
        return `
            <div class="w-[280px] sm:w-[320px] bg-white rounded-2xl p-5 shadow-lg shadow-royal-900/5 border border-[#ecd9b8]/60 flex flex-col justify-between flex-shrink-0 transition-transform duration-300 hover:-translate-y-1">
                <div>
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-royal-600 to-royal-800 text-gold-300 font-display font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                                ${escapeHtml(wish.name.charAt(0).toUpperCase())}
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-sans font-bold text-sm text-royal-900 truncate">${escapeHtml(wish.name)}</h4>
                                <span class="font-sans text-[11px] text-gray-400 block">${formatDate(wish.timestamp)}</span>
                            </div>
                        </div>
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-semibold flex-shrink-0 ${isHadir ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}">
                            ${isHadir ? '● Hadir' : '○ Berhalangan'}
                        </span>
                    </div>
                    <p class="font-body text-sm text-royal-800 leading-relaxed italic line-clamp-4">
                        "${escapeHtml(wish.message)}"
                    </p>
                </div>
            </div>
        `;
    };
    
    // Duplicate wishes to ensure seamless continuous loop
    let listContent = wishes.map(cardHtml).join('');
    // Ensure sufficient width for infinite marquee
    if (wishes.length < 5) {
        listContent = listContent + listContent + listContent;
    } else {
        listContent = listContent + listContent;
    }
    
    marqueeContainer.innerHTML = listContent;
}

// ==================== DIGITAL ENVELOPE ====================

let envelopeOpened = false;

function openEnvelope() {
    if (envelopeOpened) return;
    envelopeOpened = true;
    
    const body = document.querySelector('.envelope-body');
    if (body) body.classList.add('open');
    
    setTimeout(() => {
        const accounts = document.getElementById('gift-accounts');
        if (accounts) {
            accounts.classList.remove('hidden');
            accounts.style.animation = 'slideUp 0.6s ease-out forwards';
        }
    }, 700);
}

function submitGift(e) {
    e.preventDefault();
    
    const sender = document.getElementById('gift-sender').value.trim();
    const bank = document.getElementById('gift-bank').value;
    const amount = document.getElementById('gift-amount').value.trim();
    
    if (!sender) return;
    
    const gift = {
        id: Date.now().toString(),
        sender,
        bank,
        amount,
        timestamp: new Date().toISOString(),
    };
    
    DB.saveGift(gift);
    
    DB.saveMessage({
        id: Date.now().toString(),
        type: 'gift',
        name: sender,
        content: `Hadiah via ${bank}: ${amount || '-'}`,
        timestamp: new Date().toISOString(),
    });
    
    // Reset form
    document.getElementById('gift-sender').value = '';
    document.getElementById('gift-amount').value = '';
    
    showToast('Terima kasih atas tanda kasih Anda! 🎁');
}

function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalHTML = button.innerHTML;
        button.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Tersalin!';
        button.classList.add('bg-emerald-600', 'text-white');
        if (window.lucide) lucide.createIcons();
        
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('bg-emerald-600');
            if (window.lucide) lucide.createIcons();
        }, 2000);
    }).catch(() => {
        showToast('Gagal menyalin nomor rekening');
    });
}

// ==================== CALENDAR & SHARE ====================

function addToCalendar() {
    const title = encodeURIComponent('Pernikahan Rizky Abdul Azis & Isla Nurmila');
    const details = encodeURIComponent('Pernikahan Rizky Abdul Azis & Isla Nurmila. Akad Nikah: 09.00 - 10.00 WIB. Resepsi: 10.00 - 15.00 WIB.');
    const location = encodeURIComponent('Rumah Ibu Yeni (7°18\'39.1"S 108°11\'05.1"E)');
    const start = '20270108T020000Z';
    const end = '20270108T080000Z';
    
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
    window.open(url, '_blank');
}

function shareInvitation() {
    const title = 'Undangan Pernikahan Rizky Abdul Azis & Isla Nurmila';
    const text = 'Tanpa mengurangi rasa hormat, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di pernikahan kami: Rizky Abdul Azis & Isla Nurmila.';
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({ title, text, url }).catch(() => {});
    } else {
        navigator.clipboard.writeText(`${text}\n\nLink: ${url}`).then(() => {
            showToast('Teks & link undangan berhasil disalin! 📋');
        });
    }
}

// ==================== VISUAL EFFECTS ====================

function createSparkles() {
    const container = document.querySelector('.sparkle-container');
    if (!container) return;
    
    for (let i = 0; i < 35; i++) {
        const dot = document.createElement('div');
        dot.className = 'sparkle-dot';
        dot.style.left = `${Math.random() * 100}%`;
        dot.style.top = `${Math.random() * 100}%`;
        dot.style.animationDelay = `${Math.random() * 3}s`;
        dot.style.animationDuration = `${2 + Math.random() * 3}s`;
        container.appendChild(dot);
    }
}

function startPetals() {
    const container = document.getElementById('petals-container');
    if (!container) return;
    
    const colors = ['rgba(147, 197, 253, 0.45)', 'rgba(191, 219, 254, 0.5)', 'rgba(212, 168, 67, 0.35)'];
    
    setInterval(() => {
        if (document.hidden) return;
        
        const petal = document.createElement('div');
        petal.className = 'falling-petal';
        petal.style.left = `${Math.random() * 100}vw`;
        petal.style.animationDuration = `${7 + Math.random() * 6}s`;
        petal.style.opacity = (0.3 + Math.random() * 0.5).toFixed(2);
        
        const size = 12 + Math.random() * 12;
        petal.style.width = `${size}px`;
        petal.style.height = `${size}px`;
        petal.style.color = colors[Math.floor(Math.random() * colors.length)];
        
        petal.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 2C8 6 4 10 4 14c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-4-8-8-12z" />
            </svg>
        `;
        
        container.appendChild(petal);
        setTimeout(() => petal.remove(), 13000);
    }, 1200);
}

// ==================== UTILITIES ====================

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;
    
    toastMsg.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3500);
}

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(isoString) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '';
    }
}
