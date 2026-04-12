@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
git add -A
git commit -m "Fix subscription persistence and admin access"
git push