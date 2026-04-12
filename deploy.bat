@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
git add -A
git commit -m "Switch to local storage auth"
git push