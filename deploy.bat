@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
git add -A
git commit -m "Filter out players with existing fixtures"
git push