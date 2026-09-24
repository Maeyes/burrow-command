@echo off
cd /d C:\bunny-world
start "Bunny Arena POC" cmd /c "npm.cmd exec vite -- --config art-test\arena-poc\vite.config.ts"
timeout /t 2 >nul
start "" http://127.0.0.1:4178/
