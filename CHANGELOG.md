# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2026-05-08

### 🔥 Added
- **Puppeteer Stealth Mode**: Automatic bypass for Cloudflare and 403 errors
- 17 advanced stealth techniques to avoid bot detection
- Smart fallback: axios (fast) → Puppeteer (powerful) when needed
- Browser instance pooling for better performance
- Graceful shutdown handlers for browser cleanup

### ✨ Improved
- Better error messages with Arabic support
- Enhanced retry logic with exponential backoff
- More reliable scraping for protected websites
- Updated package name to `@islamic-scholar/mcp-server`

### 📦 Dependencies
- Added `puppeteer` ^24.0.0
- Added `puppeteer-extra` ^3.3.6
- Added `puppeteer-extra-plugin-stealth` ^2.11.2

### 🐛 Fixed
- Fixed 403 Forbidden errors on Islamweb and Dorar
- Fixed connection reset errors with better retry logic
- Fixed timeout issues with longer wait times

---

## [2.0.0] - 2026-01-15

### Added
- DuckDuckGo search engine integration
- Multi-site search across 6+ Islamic websites
- Research file management system
- 10 comprehensive tools for Islamic research

### Changed
- Switched from direct scraping to DuckDuckGo search
- Improved content extraction with Cheerio
- Better Arabic text handling

---

## [1.0.0] - 2025-12-01

### Added
- Initial release
- Basic scraping for Islamweb and Dorar
- MCP Server implementation
- 5 core tools
