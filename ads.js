import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = "https://uyabibpagreajvwtznoy.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5YWJpYnBhZ3JlYWp2d3R6bm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDgwNjMsImV4cCI6MjA3NzkyNDA2M30.M0kEFlJ6RaNx8yu6LJ0qKm42v3WhAV2OJfWIalil8QE";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

class AdManager {
    constructor() {
        this.ads = [];
        this.activePopups = new Set();
    }

    // Load semua iklan aktif
    async loadAds() {
        try {
            const { data: ads, error } = await supabase
                .from('ads')
                .select('*')
                .eq('is_active', true)
                .lte('start_date', new Date().toISOString())
                .gte('end_date', new Date().toISOString());

            if (error) throw error;
            
            this.ads = ads || [];
            this.renderAds();
            this.setupAdAnalytics();
            
        } catch (error) {
            console.error('Error loading ads:', error);
        }
    }

    // Render iklan berdasarkan type dan position
    renderAds() {
        this.ads.forEach(ad => {
            switch(ad.ad_type) {
                case 'banner':
                    this.renderBannerAd(ad);
                    break;
                case 'popup':
                    this.renderPopupAd(ad);
                    break;
                case 'interstitial':
                    this.renderInterstitialAd(ad);
                    break;
                case 'native':
                    this.renderNativeAd(ad);
                    break;
                case 'video':
                    this.renderVideoAd(ad);
                    break;
            }
        });
    }

    // Render banner ads
    renderBannerAd(ad) {
        const container = document.querySelector(`[data-ad-position="${ad.position}"]`);
        if (!container) return;

        const adHTML = `
            <div class="ad-container" data-ad-id="${ad.id}">
                <div class="ad-label">Iklan</div>
                <div class="ad-banner ad-banner-${ad.ad_size}">
                    ${ad.ad_code}
                </div>
            </div>
        `;

        container.innerHTML += adHTML;
        this.trackImpression(ad.id);
    }

    // Render popup ads
    renderPopupAd(ad) {
        // Delay popup untuk user experience
        setTimeout(() => {
            if (this.activePopups.has(ad.id)) return;

            const popupHTML = `
                <div class="ad-popup" data-ad-id="${ad.id}">
                    <div class="ad-popup-content">
                        <button class="ad-close" onclick="adManager.closePopup('${ad.id}')">×</button>
                        <div class="ad-content">
                            ${ad.ad_code}
                        </div>
                    </div>
                </div>
            `;

            document.body.innerHTML += popupHTML;
            this.activePopups.add(ad.id);
            this.trackImpression(ad.id);
        }, 3000);
    }

    // Render interstitial ads
    renderInterstitialAd(ad) {
        // Tampilkan interstitial setiap 3 page view
        const viewCount = parseInt(localStorage.getItem('page_views') || '0') + 1;
        localStorage.setItem('page_views', viewCount.toString());

        if (viewCount % 3 === 0) {
            this.showInterstitialAd(ad);
        }
    }

    showInterstitialAd(ad) {
        const interstitialHTML = `
            <div class="ad-interstitial" data-ad-id="${ad.id}">
                <div class="ad-countdown" id="countdown-${ad.id}">5</div>
                <div class="ad-content">
                    ${ad.ad_code}
                </div>
                <button class="ad-close" onclick="adManager.closeInterstitial('${ad.id}')" style="margin-top: 20px;">
                    Lewati Iklan
                </button>
            </div>
        `;

        document.body.innerHTML += interstitialHTML;
        this.startCountdown(ad.id);
        this.trackImpression(ad.id);
    }

    startCountdown(adId) {
        let countdown = 5;
        const countdownElement = document.getElementById(`countdown-${adId}`);
        const interval = setInterval(() => {
            countdown--;
            countdownElement.textContent = countdown;
            
            if (countdown <= 0) {
                clearInterval(interval);
                this.closeInterstitial(adId);
            }
        }, 1000);
    }

    // Native ads
    renderNativeAd(ad) {
        const nativeContainers = document.querySelectorAll('[data-native-ad]');
        nativeContainers.forEach(container => {
            container.innerHTML = ad.ad_code;
            this.trackImpression(ad.id);
        });
    }

    // Video ads
    renderVideoAd(ad) {
        const videoContainers = document.querySelectorAll('[data-video-ad]');
        videoContainers.forEach(container => {
            container.innerHTML = ad.ad_code;
            this.trackImpression(ad.id);
        });
    }

    // Close methods
    closePopup(adId) {
        const popup = document.querySelector(`[data-ad-id="${adId}"]`);
        if (popup) {
            popup.remove();
            this.activePopups.delete(adId);
        }
    }

    closeInterstitial(adId) {
        const interstitial = document.querySelector(`[data-ad-id="${adId}"]`);
        if (interstitial) {
            interstitial.remove();
        }
    }

    // Tracking analytics
    async trackImpression(adId) {
        try {
            // Update impression count
            await supabase
                .from('ads')
                .update({ impressions: supabase.raw('impressions + 1') })
                .eq('id', adId);

            // Record analytics
            await supabase
                .from('ad_analytics')
                .insert([{
                    ad_id: adId,
                    event_type: 'impression',
                    page_url: window.location.href,
                    user_agent: navigator.userAgent
                }]);

        } catch (error) {
            console.error('Error tracking impression:', error);
        }
    }

    async trackClick(adId) {
        try {
            // Update click count
            await supabase
                .from('ads')
                .update({ clicks: supabase.raw('clicks + 1') })
                .eq('id', adId);

            // Record analytics
            await supabase
                .from('ad_analytics')
                .insert([{
                    ad_id: adId,
                    event_type: 'click',
                    page_url: window.location.href,
                    user_agent: navigator.userAgent
                }]);

        } catch (error) {
            console.error('Error tracking click:', error);
        }
    }

    setupAdAnalytics() {
        // Track clicks on ads
        document.addEventListener('click', (e) => {
            const adElement = e.target.closest('[data-ad-id]');
            if (adElement) {
                const adId = adElement.dataset.adId;
                this.trackClick(adId);
            }
        });
    }

    // Get ad statistics
    async getAdStats() {
        try {
            const { data: stats, error } = await supabase
                .from('ads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return stats;

        } catch (error) {
            console.error('Error getting ad stats:', error);
            return [];
        }
    }
}

// Initialize ad manager
const adManager = new AdManager();

// Export untuk penggunaan di file lain
export { adManager, supabase };