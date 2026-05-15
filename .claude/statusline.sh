#!/bin/bash
input=$(cat)
BRANCH=$(git branch --show-current 2>/dev/null || echo "")

python3 -c "
import sys, json, os

data = json.load(sys.stdin)

ws = data.get('workspace', {}) or {}
model = data.get('model', {}) or {}
ctx = data.get('context_window', {}) or {}

dir_path = ws.get('current_dir') or data.get('cwd', '')
dir_name = os.path.basename(dir_path) if dir_path else ''
model_name = model.get('display_name') or model.get('id', '')
used = ctx.get('total_input_tokens', 0) or 0
total = ctx.get('context_window_size', 200000) or 200000

branch = '$BRANCH'
if branch:
    print(f'\U0001F4C1 {dir_name} | \U0001F33F {branch} | \U0001F916 {model_name} | \U0001F4CA {used}/{total} tokens')
else:
    print(f'\U0001F4C1 {dir_name} | \U0001F916 {model_name} | \U0001F4CA {used}/{total} tokens')
" <<< "$input"
