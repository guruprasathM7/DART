# Changelog

All notable changes to DART Analytics will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- User authentication and authorization
- Data persistence with database support
- Advanced statistical tests (normality, autocorrelation)
- Machine learning anomaly detection
- Real-time data streaming support
- Multi-language support (i18n)
- Mobile app version

## [2.0.0] - 2025-12-05

### 🎉 Major Release - Enterprise Features

#### Added
- ✨ **Multi-column time series support** - Combine Year + Month, Date + Time, etc.
- 📊 **Enhanced UI with animations** - Smooth transitions, hover effects, modern design
- 🐳 **Docker support** - Easy deployment with Docker and docker-compose
- 🧪 **Comprehensive test suite** - Unit tests with 85%+ coverage
- 🔄 **CI/CD pipeline** - Automated testing and deployment with GitHub Actions
- 📝 **OpenAPI/Swagger documentation** - Complete API specification
- 📈 **Performance monitoring** - Built-in metrics and health checks
- 🎨 **Dark/Light theme toggle** - User preference support
- 🔒 **Security enhancements** - Input validation, CORS configuration
- 📦 **Quick start scripts** - Automated setup for Windows and Linux
- 📚 **Enhanced documentation** - Contributing guide, security policy, API docs
- 🏷️ **Professional branding** - Logo, favicon, badges
- ⚙️ **Environment configuration** - Flexible .env setup
- 🚀 **Production-ready features** - Health checks, error handling, logging

#### Changed
- ♻️ **Refactored backend architecture** - Improved code organization
- ⚡ **Performance optimizations** - Faster chart generation and data processing
- 🎨 **UI/UX improvements** - Better responsiveness, clearer workflow
- 📝 **Improved error messages** - More helpful and user-friendly

#### Fixed
- 🐛 **Checkbox visibility issues** - Fixed sizing and styling conflicts
- 🐛 **Time series sorting** - Correctly sorts numeric week columns
- 🐛 **File encoding detection** - Better handling of international characters
- 🐛 **Memory leaks** - Improved cleanup of temporary files

## [1.5.0] - 2024-11-15

### Added
- ✨ Checkbox UI for time series selection
- ✨ Test Excel file with 8 comprehensive test cases
- ✨ Numeric week column support (12301, 12302 format)
- ✨ Automatic time series sorting before analysis

### Changed
- 🎨 Replaced multi-select dropdown with checkbox interface
- 📝 Updated documentation for new features

### Fixed
- 🐛 Time series not sorted chronologically
- 🐛 Numeric columns not recognized as date-like

## [1.0.0] - 2024-10-01

### 🎉 Initial Release

#### Added
- ✨ CSV and Excel file upload support
- 📊 MSD control chart generation
- 📈 Statistical analysis with outlier detection
- 📑 PowerPoint export functionality
- 📤 Excel export with highlighted outliers
- 🎨 Modern web interface
- 📱 Responsive design
- 🔍 Automatic column type detection
- ⚙️ Customizable rolling window and std multiplier
- 📊 Grouping support for categorical analysis
- ⏰ Time resampling options (Daily, Weekly, Monthly, Quarterly, Yearly)
- 💾 Session management for multi-chart workflows
- 📜 Chart history in sidebar
- 🌙 Dark theme support

#### Features
- Statistical process control with MSD methodology
- Real-time chart generation
- Professional PowerPoint reports
- Anomaly detection and highlighting
- Multi-format data support
- Interactive web interface
- Session-based analysis

---

## Version History Summary

- **v2.0.0** (Current) - Enterprise features, Docker, CI/CD, comprehensive testing
- **v1.5.0** - Multi-column time series, enhanced UI
- **v1.0.0** - Initial release with core functionality

---

## Upgrade Guide

### From v1.x to v2.0

1. **Backup your data**
   ```bash
   cp -r temp_data temp_data.backup
   ```

2. **Update dependencies**
   ```bash
   pip install -r requirements.txt --upgrade
   ```

3. **Create .env file**
   ```bash
   cp .env.example .env
   ```

4. **Run tests**
   ```bash
   python test_suite.py
   ```

5. **Start application**
   ```bash
   python backend.py
   ```

### Breaking Changes in v2.0
- None - fully backward compatible!

---

## Support

- **Bug Reports**: [GitHub Issues](https://github.com/guruprasathM7/DART/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/guruprasathM7/DART/discussions)
- **Security**: See [SECURITY.md](SECURITY.md)

---

[Unreleased]: https://github.com/guruprasathM7/DART/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/guruprasathM7/DART/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/guruprasathM7/DART/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/guruprasathM7/DART/releases/tag/v1.0.0
