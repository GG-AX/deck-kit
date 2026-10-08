@echo off
rem Opens the presentation (the one .html in this folder) and a small local helper,
rem so "Save notes" in the presenter window writes straight into assets\notes.js.
start "" powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0assets\notes_server.ps1"
for %%f in ("%~dp0*.html") do (start "" "%%f" & goto :eof)
