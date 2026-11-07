#!/usr/bin/env python3
"""Compatibility entry point for the Rulesync harness deployment."""
from pathlib import Path
import os
import sys
script = Path(__file__).resolve().parents[1] / 'rulesync/deploy.py'
os.execv(sys.executable, [sys.executable, str(script), *sys.argv[1:]])
