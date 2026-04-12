@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
git add -A
git commit -m "Fix Firebase exports for build"
git push