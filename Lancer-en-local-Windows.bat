@echo off
title Kit MSS - test en local
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0assets\serveur-local.ps1"
if errorlevel 1 pause
