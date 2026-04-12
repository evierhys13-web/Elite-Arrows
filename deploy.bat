@echo off
set PATH=C:\Program Files\Git\cmd;%PATH%
git add -A
git commit -m "Separate PayPal emails per tier"
git push