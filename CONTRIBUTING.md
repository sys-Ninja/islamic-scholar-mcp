# Contributing to Islamic Scholar MCP

جزاك الله خيراً for your interest in contributing! 🌟

## How to Contribute

### 1. Report Bugs 🐛

Found a bug? Please open an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node version)

### 2. Suggest Features ✨

Have an idea? Open an issue with:
- Feature description
- Use case / why it's needed
- Proposed implementation (optional)

### 3. Submit Pull Requests 🔧

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use ES6+ features
- Follow existing code style
- Add comments in Arabic for Islamic content
- Add JSDoc comments for functions
- Keep functions small and focused

### Testing

Before submitting:
```bash
# Test the MCP server
npm start

# Test with a real query
# (use your MCP client to test)
```

### Adding New Islamic Sources

To add a new Islamic website:

1. Add domain to `ALLOWED` array in `toolFetchIslamicPage`
2. Create a scraper function (e.g., `scrapeNewSite`)
3. Add search function (e.g., `ddgNewSite`)
4. Add tool definition in `ListToolsRequestSchema`
5. Add handler in `CallToolRequestSchema`
6. Update README with new source
7. Test thoroughly

### Commit Messages

Use clear, descriptive messages:
- ✅ `feat: add support for IslamQA website`
- ✅ `fix: handle 403 errors with Puppeteer`
- ✅ `docs: update installation instructions`
- ❌ `update stuff`
- ❌ `fix bug`

### Questions?

Open a discussion or issue - we're here to help!

---

**May Allah reward you for your contributions! 🤲**
