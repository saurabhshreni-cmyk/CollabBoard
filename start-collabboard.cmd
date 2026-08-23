@echo off
REM ---------------------------------------------------------------
REM  CollabBoard - start the whole stack locally (Windows)
REM
REM  Backend  : http://localhost:8080  (in-memory H2, no DB setup)
REM  Frontend : http://localhost:5173
REM
REM  Double-click this file, or run it from a terminal.
REM  Logs land in the logs\ folder. Run stop-collabboard.cmd to stop.
REM ---------------------------------------------------------------
setlocal
set ROOT=%~dp0
set JAR=%ROOT%collabboard-backend\target\collabboard-backend-1.0.0.jar

if not exist "%ROOT%logs" mkdir "%ROOT%logs"

echo [1/3] Building the backend (skipping tests)...
pushd "%ROOT%collabboard-backend"
call mvnw.cmd -B package -DskipTests
if errorlevel 1 (
  echo Backend build FAILED - see the output above.
  popd & pause & exit /b 1
)
popd

echo [2/3] Starting the backend on :8080 ...
start "" /b javaw -jar "%JAR%" --spring.profiles.active=dev > "%ROOT%logs\backend.log" 2>&1

echo [3/3] Starting the frontend on :5173 ...
pushd "%ROOT%collabboard-frontend"
if not exist node_modules (
  echo     installing npm dependencies, this takes a minute...
  call npm ci --no-audit --no-fund
)
start "" /b cmd /c "npm run dev > "%ROOT%logs\frontend.log" 2>&1"
popd

echo.
echo Waiting for the servers to come up...
timeout /t 25 /nobreak > nul
start "" http://localhost:5173

echo.
echo CollabBoard is running:
echo    http://localhost:5173   (open a second tab to collaborate with yourself)
echo    http://localhost:8080/api/health
echo.
echo Boards are stored in memory and reset when you stop the backend.
echo Run stop-collabboard.cmd to shut everything down.
pause
