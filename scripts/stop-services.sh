#!/bin/zsh
set -e
brew services stop ollama
brew services stop redis
brew services stop postgresql@17
