@echo off
REM Stops the CollabBoard backend (:8080) and frontend (:5173).
REM Only touches processes listening on those two ports, nothing else.
setlocal enabledelayedexpansion

for %%P in (8080 5173) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /r /c:"LISTENING" ^| findstr ":%%P "') do (
    echo Stopping process %%A on port %%P
    taskkill /PID %%A /F > nul 2>&1
  )
)

echo.
echo CollabBoard stopped.
pause
