#!/bin/bash
set -e
BUN_VERSION="1.3.1"
# Ensure in main root
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"
cd "$DIR/../"
echo "Setting up development environment..."
# Ensure brew is installed and up to date
echo "Checking Homebrew..."
if ! command -v brew &> /dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
brew update
brew upgrade
# Install brew dependencies
echo "Installing brew dependencies..."
brew install pre-commit
# Install Bun
echo "Installing Bun v$BUN_VERSION..."
if ! command -v bun &> /dev/null; then
  curl -fsSL https://bun.sh/install | bash -s "bun-v$BUN_VERSION"
else
  echo "Bun already installed: $(bun --version)"
fi
# Install project dependencies
echo "Installing project dependencies..."
bun install
# Set up pre-commit hooks
echo "Setting up pre-commit hooks..."
pre-commit install
echo "Everything is setup :)"