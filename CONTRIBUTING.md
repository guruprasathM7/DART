# Contributing to DART Analytics

First off, thank you for considering contributing to DART Analytics! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Testing](#testing)

## 🤝 Code of Conduct

This project and everyone participating in it is governed by our commitment to creating a welcoming and inclusive environment. Be respectful, professional, and constructive in all interactions.

## 💡 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When you create a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Python version, browser)
- **Sample data** if relevant (anonymized)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear use case** - why this enhancement would be useful
- **Detailed description** of the suggested enhancement
- **Mockups or examples** if applicable
- **Potential implementation approach**

### Pull Requests

1. **Fork** the repository
2. **Create a feature branch** (`git checkout -b feature/AmazingFeature`)
3. **Make your changes** with clear, descriptive commits
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Run the test suite** to ensure everything passes
7. **Submit a pull request**

## 🛠️ Development Setup

### Prerequisites

- Python 3.8 or higher
- Git
- Virtual environment tool (venv, conda, etc.)

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/DART.git
cd DART

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # If available

# Install pre-commit hooks (optional)
pip install pre-commit
pre-commit install

# Run tests to verify setup
python test_suite.py
```

### Running the Application

```bash
# Start the backend server
python backend.py

# Open browser to http://localhost:5000
```

## 🔄 Pull Request Process

1. **Update Documentation**: Ensure README, API docs, and inline comments are updated
2. **Add Tests**: Include unit tests for new features or bug fixes
3. **Follow Style Guide**: Code should follow PEP 8 and project conventions
4. **One Feature Per PR**: Keep pull requests focused on a single feature or fix
5. **Describe Changes**: Provide a clear description of what and why
6. **Link Issues**: Reference related issues using `Fixes #123` or `Relates to #456`

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated and passing
- [ ] No new warnings generated
- [ ] Dependent changes merged and published

## 📝 Style Guidelines

### Python Code Style

We follow [PEP 8](https://www.python.org/dev/peps/pep-0008/) with some modifications:

```python
# Good
def calculate_control_limits(data, std_multiplier=3):
    """
    Calculate upper and lower control limits.
    
    Args:
        data: Pandas Series with numeric values
        std_multiplier: Standard deviation multiplier (default: 3)
    
    Returns:
        tuple: (upper_limit, lower_limit)
    """
    mean = data.mean()
    std = data.std()
    return mean + (std_multiplier * std), mean - (std_multiplier * std)

# Use type hints when possible
def process_data(df: pd.DataFrame, column: str) -> pd.Series:
    return df[column].dropna()
```

### JavaScript Code Style

```javascript
// Use const/let, not var
const APP_NAME = 'DART Analytics';
let sessionId = null;

// Clear, descriptive function names
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    uploadFile(file);
}

// Use async/await for promises
async function fetchData(url) {
    try {
        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('Fetch failed:', error);
        throw error;
    }
}
```

### Git Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- First line should be 50 characters or less
- Reference issues and pull requests after the first line

```
✨ Add multi-column time series support

- Implement column combination logic
- Add support for Year + Month combinations
- Update UI with checkbox selection
- Add comprehensive test cases

Fixes #123
```

### Commit Emoji Guide

- ✨ `:sparkles:` - New feature
- 🐛 `:bug:` - Bug fix
- 📝 `:memo:` - Documentation
- 🎨 `:art:` - UI/style improvements
- ⚡ `:zap:` - Performance improvement
- ♻️ `:recycle:` - Code refactoring
- ✅ `:white_check_mark:` - Tests
- 🔒 `:lock:` - Security fix
- ⬆️ `:arrow_up:` - Dependency upgrade
- 🚀 `:rocket:` - Deployment

## 🧪 Testing

### Running Tests

```bash
# Run all tests
python test_suite.py

# Run with coverage
pytest test_suite.py --cov=backend --cov-report=html

# Run specific test
python -m unittest test_suite.TestDARTAnalytics.test_upload_csv_success
```

### Writing Tests

```python
def test_feature_name(self):
    """Test description"""
    # Arrange
    data = create_test_data()
    
    # Act
    result = process_data(data)
    
    # Assert
    self.assertEqual(result, expected_value)
    self.assertTrue(result.success)
```

## 📚 Additional Resources

- [Python Style Guide (PEP 8)](https://www.python.org/dev/peps/pep-0008/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [Pandas Documentation](https://pandas.pydata.org/docs/)
- [Matplotlib Guidelines](https://matplotlib.org/stable/tutorials/index.html)

## 🎓 Learning Resources

New to contributing? Here are some helpful resources:

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Writing Good Commit Messages](https://chris.beams.io/posts/git-commit/)

## 🆘 Getting Help

- Open an issue with the `question` label
- Check existing documentation and issues
- Reach out to maintainers for guidance

## 🏆 Recognition

Contributors are recognized in:
- README.md Contributors section
- Release notes
- Project documentation

Thank you for making DART Analytics better! 🙌
