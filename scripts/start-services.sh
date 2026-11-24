#!/bin/zsh
set -e
brew services start postgresql@17
brew services start redis
brew services start ollama
