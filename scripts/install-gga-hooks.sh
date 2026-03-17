#!/bin/bash
# GGA Hooks Installation Script
# Installs pre-commit and commit-msg hooks for Gentleman Guardian Angel

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Gentleman Guardian Angel - Hook Installation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if GGA is installed
echo "Checking for GGA installation..."
if ! command -v gga &> /dev/null; then
    echo -e "${RED}❌ GGA not found${NC}"
    echo ""
    echo "Please install Gentleman Guardian Angel first:"
    echo ""
    echo -e "${BLUE}Option 1: Homebrew (recommended)${NC}"
    echo "  brew install gentleman-programming/tap/gga"
    echo ""
    echo -e "${BLUE}Option 2: Manual installation${NC}"
    echo "  git clone https://github.com/Gentleman-Programming/gentleman-guardian-angel.git"
    echo "  cd gentleman-guardian-angel"
    echo "  ./install.sh"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ GGA found: $(gga version)${NC}"
echo ""

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Not a git repository${NC}"
    echo "Please run this script from the root of your git repository."
    exit 1
fi

# Check if .gga config exists
if [ ! -f ".gga" ]; then
    echo -e "${YELLOW}⚠️  .gga configuration file not found${NC}"
    echo "Creating default configuration..."
    gga init
    echo -e "${GREEN}✅ Created .gga configuration${NC}"
    echo ""
fi

# Check if AGENTS.md exists
if [ ! -f "AGENTS.md" ]; then
    echo -e "${YELLOW}⚠️  AGENTS.md rules file not found${NC}"
    echo "Please create AGENTS.md with your code review rules."
    echo ""
fi

# Install pre-commit hook
echo "Installing pre-commit hook..."
if [ -f ".git/hooks/pre-commit" ]; then
    echo -e "${YELLOW}⚠️  Pre-commit hook already exists${NC}"
    echo "Backing up existing hook to .git/hooks/pre-commit.backup"
    cp .git/hooks/pre-commit .git/hooks/pre-commit.backup
fi

# Use gga install command
if gga install; then
    echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
else
    echo -e "${RED}❌ Failed to install pre-commit hook${NC}"
    exit 1
fi

# Install commit-msg hook
echo ""
echo "Installing commit-msg hook..."
if [ -f ".git/hooks/commit-msg" ]; then
    echo -e "${YELLOW}⚠️  Commit-msg hook already exists${NC}"
    echo "Backing up existing hook to .git/hooks/commit-msg.backup"
    cp .git/hooks/commit-msg .git/hooks/commit-msg.backup
fi

if gga install --commit-msg; then
    echo -e "${GREEN}✅ Commit-msg hook installed${NC}"
else
    echo -e "${RED}❌ Failed to install commit-msg hook${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ GGA hooks installed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "  1. Ensure AGENTS.md contains your code review rules"
echo "  2. Configure AI provider credentials (e.g., ANTHROPIC_API_KEY)"
echo "  3. Try making a commit - GGA will review your code automatically"
echo ""
echo "To bypass GGA checks in emergencies:"
echo "  git commit --no-verify"
echo ""
echo "To view GGA configuration:"
echo "  gga config"
echo ""
echo "To manually run GGA:"
echo "  gga run"
echo ""

exit 0
