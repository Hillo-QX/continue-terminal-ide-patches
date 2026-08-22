@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_continue_patch.ps1" %*
if errorlevel 1 (
  echo.
  echo 补丁安装失败，请查看上面的错误信息。
  pause
  exit /b 1
)
endlocal
