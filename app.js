// AI News Hub Application
class AINewsHub {
    constructor() {
        this.articles = [];
        this.sources = [
            {
                name: 'TechCrunch AI',
                url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
                color: '#0AB800',
                description: 'Tech startup news and AI developments',
                slug: 'techcrunch'
            },
            {
                name: 'MIT News AI',
                url: 'https://news.mit.edu/topic/mitartificial-intelligence2/feed',
                color: '#A31F34',
                description: 'Research and academic AI news from MIT',
                slug: 'mit'
            },
            {
                name: 'VentureBeat AI',
                url: 'https://venturebeat.com/category/ai/feed/',
                color: '#0080FF',
                description: 'Enterprise AI and business technology',
                slug: 'venturebeat'
            },
            {
                name: 'The Verge AI',
                url: 'https://theverge.com/rss/ai-artificial-intelligence/index.xml',
                color: '#FA4B2A',
                description: 'Consumer tech and AI culture',
                slug: 'verge'
            },
            {
                name: 'Wired AI',
                url: 'https://wired.com/feed/tag/ai/latest/rss',
                color: '#000000',
                description: 'Technology journalism and AI analysis',
                slug: 'wired'
            },
            {
                name: 'OpenAI News',
                url: 'https://openai.com/news/rss.xml',
                color: '#10A37F',
                description: 'Official OpenAI announcements and research',
                slug: 'openai'
            }
        ];
        this.lastUpdated = null;
        this.refreshInterval = null;
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupTheme();
        this.renderSources();
        this.fetchAllArticles();
        this.setupAutoRefresh();
    }
    
    setupEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
        // Manual refresh
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchAllArticles());
        }
    }
    
    setupTheme() {
        // Check for saved theme preference or default to system preference
        const savedTheme = this.getThemePreference();
        if (savedTheme) {
            document.documentElement.setAttribute('data-color-scheme', savedTheme);
        }
    }
    
    getThemePreference() {
        // In sandboxed environment, we'll use a simple variable instead of localStorage
        return this.currentTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-color-scheme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-color-scheme', newTheme);
        this.currentTheme = newTheme; // Store in memory instead of localStorage
    }
    
    renderSources() {
        const sourcesList = document.getElementById('sourcesList');
        if (!sourcesList) return;
        
        sourcesList.innerHTML = this.sources.map(source => `
            <div class="source-item">
                <div class="source-item__indicator" style="background-color: ${source.color}"></div>
                <div class="source-item__content">
                    <div class="source-item__name">${source.name}</div>
                    <div class="source-item__description">${source.description}</div>
                </div>
                <div class="source-item__count" id="count-${source.slug}">0</div>
            </div>
        `).join('');
    }
    
    async fetchAllArticles() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.showLoading();
        
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
        }
        
        try {
            const fetchPromises = this.sources.map(source => this.fetchSourceArticles(source));
            const results = await Promise.allSettled(fetchPromises);
            
            // Combine all successful results
            this.articles = [];
            const sourceCounts = {};
            
            results.forEach((result, index) => {
                const source = this.sources[index];
                sourceCounts[source.slug] = 0;
                
                if (result.status === 'fulfilled' && result.value) {
                    const articles = result.value;
                    this.articles = this.articles.concat(articles);
                    sourceCounts[source.slug] = articles.length;
                }
            });
            
            // Sort articles by date (newest first)
            this.articles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            
            // Update source counts
            this.updateSourceCounts(sourceCounts);
            
            // Update last updated time
            this.lastUpdated = new Date();
            this.updateLastUpdatedTime();
            
            // Render articles
            this.renderArticles();
            
            this.hideLoading();
            
        } catch (error) {
            console.error('Error fetching articles:', error);
            this.showError();
        } finally {
            this.isLoading = false;
            if (refreshBtn) {
                refreshBtn.classList.remove('loading');
            }
        }
    }
    
    async fetchSourceArticles(source) {
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(source.url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            const xmlText = data.contents;
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
            
            // Check for parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing error');
            }
            
            const items = xmlDoc.querySelectorAll('item');
            const articles = [];
            
            items.forEach((item, index) => {
                if (index < 10) { // Limit to 10 articles per source
                    const article = this.parseArticle(item, source);
                    if (article) {
                        articles.push(article);
                    }
                }
            });
            
            return articles;
            
        } catch (error) {
            console.error(`Error fetching ${source.name}:`, error);
            return [];
        }
    }
    
    parseArticle(item, source) {
        try {
            const title = this.getTextContent(item, 'title');
            const link = this.getTextContent(item, 'link');
            const description = this.getTextContent(item, 'description') || this.getTextContent(item, 'summary');
            const pubDate = this.getTextContent(item, 'pubDate') || this.getTextContent(item, 'published');
            
            if (!title || !link) {
                return null;
            }
            
            // Extract image from description or content:encoded
            let imageUrl = this.extractImageFromContent(description) || 
                          this.extractImageFromContent(this.getTextContent(item, 'content:encoded'));
            
            // Clean up description (remove HTML tags and truncate)
            const cleanDescription = this.cleanDescription(description);
            
            return {
                title: this.cleanText(title),
                link: link.trim(),
                description: cleanDescription,
                pubDate: pubDate ? new Date(pubDate) : new Date(),
                source: source,
                imageUrl: imageUrl
            };
            
        } catch (error) {
            console.error('Error parsing article:', error);
            return null;
        }
    }
    
    getTextContent(item, tagName) {
        const element = item.querySelector(tagName);
        return element ? element.textContent.trim() : '';
    }
    
    cleanText(text) {
        return text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
    
    cleanDescription(description) {
        if (!description) return '';
        
        // Remove HTML tags
        let clean = description.replace(/<[^>]*>/g, '');
        
        // Replace common HTML entities
        clean = clean.replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ');
        
        // Clean up whitespace
        clean = clean.replace(/\s+/g, ' ').trim();
        
        // Truncate to reasonable length
        if (clean.length > 200) {
            clean = clean.substring(0, 200) + '...';
        }
        
        return clean;
    }
    
    extractImageFromContent(content) {
        if (!content) return null;
        
        // Look for img tags
        const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
        if (imgMatch) {
            return imgMatch[1];
        }
        
        // Look for common image URLs in text
        const urlMatch = content.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp)/i);
        if (urlMatch) {
            return urlMatch[0];
        }
        
        return null;
    }
    
    updateSourceCounts(counts) {
        Object.entries(counts).forEach(([slug, count]) => {
            const countElement = document.getElementById(`count-${slug}`);
            if (countElement) {
                countElement.textContent = count;
            }
        });
    }
    
    updateLastUpdatedTime() {
        const updateTimeElement = document.getElementById('updateTime');
        if (updateTimeElement && this.lastUpdated) {
            updateTimeElement.textContent = this.formatDate(this.lastUpdated);
        }
    }
    
    renderArticles() {
        if (this.articles.length === 0) {
            this.showError();
            return;
        }
        
        // Render featured article (first/newest article)
        this.renderFeaturedArticle(this.articles[0]);
        
        // Render articles grid (skip the first article as it's featured)
        this.renderArticlesGrid(this.articles.slice(1));
    }
    
    renderFeaturedArticle(article) {
        const featuredSection = document.getElementById('featuredSection');
        const featuredArticle = document.getElementById('featuredArticle');
        
        if (!featuredSection || !featuredArticle || !article) return;
        
        const imageHtml = article.imageUrl ? 
            `<img src="${article.imageUrl}" alt="${article.title}" class="featured-article__image" onerror="this.style.display='none'">` : '';
        
        featuredArticle.innerHTML = `
            ${imageHtml}
            <div class="featured-article__content">
                <div class="featured-article__header">
                    <div class="source-badge source-badge--${article.source.slug}">${article.source.name}</div>
                    <div class="publication-date">${this.formatDate(article.pubDate)}</div>
                </div>
                <h2 class="featured-article__title">
                    <a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                </h2>
                <p class="featured-article__description">${article.description}</p>
                <div class="featured-article__meta">
                    <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more-btn">
                        Read Full Article
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M7 17L17 7M17 7H7M17 7V17"/>
                        </svg>
                    </a>
                </div>
            </div>
        `;
        
        featuredSection.style.display = 'block';
    }
    
    renderArticlesGrid(articles) {
        const articlesSection = document.getElementById('articlesSection');
        const articlesGrid = document.getElementById('articlesGrid');
        
        if (!articlesSection || !articlesGrid) return;
        
        articlesGrid.innerHTML = articles.map(article => {
            const imageHtml = article.imageUrl ? 
                `<img src="${article.imageUrl}" alt="${article.title}" class="article-card__image" onerror="this.style.display='none'">` : '';
            
            return `
                <article class="article-card">
                    ${imageHtml}
                    <div class="article-card__content">
                        <div class="article-card__header">
                            <div class="source-badge source-badge--${article.source.slug}">${article.source.name}</div>
                        </div>
                        <h3 class="article-card__title">
                            <a href="${article.link}" target="_blank" rel="noopener noreferrer">${article.title}</a>
                        </h3>
                        <p class="article-card__description">${article.description}</p>
                        <div class="article-card__footer">
                            <div class="article-card__meta">
                                <span class="publication-date">${this.formatDate(article.pubDate)}</span>
                            </div>
                            <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="read-more-btn">
                                Read More
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M7 17L17 7M17 7H7M17 7V17"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        
        articlesSection.style.display = 'block';
    }
    
    formatDate(date) {
        if (!date) return '';
        
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
        } else {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }
    
    setupAutoRefresh() {
        // Auto-refresh every 5 minutes (300000 ms)
        this.refreshInterval = setInterval(() => {
            if (!this.isLoading) {
                this.fetchAllArticles();
            }
        }, 300000);
    }
    
    showLoading() {
        const loadingContainer = document.getElementById('loadingContainer');
        const errorContainer = document.getElementById('errorContainer');
        const featuredSection = document.getElementById('featuredSection');
        const articlesSection = document.getElementById('articlesSection');
        
        if (loadingContainer) loadingContainer.style.display = 'block';
        if (errorContainer) errorContainer.style.display = 'none';
        if (featuredSection) featuredSection.style.display = 'none';
        if (articlesSection) articlesSection.style.display = 'none';
    }
    
    hideLoading() {
        const loadingContainer = document.getElementById('loadingContainer');
        if (loadingContainer) {
            loadingContainer.style.display = 'none';
        }
    }
    
    showError() {
        const loadingContainer = document.getElementById('loadingContainer');
        const errorContainer = document.getElementById('errorContainer');
        const featuredSection = document.getElementById('featuredSection');
        const articlesSection = document.getElementById('articlesSection');
        
        if (loadingContainer) loadingContainer.style.display = 'none';
        if (errorContainer) errorContainer.style.display = 'block';
        if (featuredSection) featuredSection.style.display = 'none';
        if (articlesSection) articlesSection.style.display = 'none';
    }
    
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.aiNewsHub = new AINewsHub();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.aiNewsHub) {
        window.aiNewsHub.destroy();
    }
});