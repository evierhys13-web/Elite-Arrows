@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
git add -A
git commit -m "Fix auth context error handling"
git push