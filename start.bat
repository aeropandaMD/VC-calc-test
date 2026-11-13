@echo off
setlocal EnableExtensions

rem Run from this batch file's directory, regardless of the current directory.
cd /d "%~dp0" || (
  echo ERROR: Cannot open the project directory.
  exit /b 1
)

if not exist "index.html" (
  echo ERROR: index.html is missing in "%CD%".
  exit /b 1
)
if not exist "app.js" (
  echo ERROR: app.js is missing in "%CD%".
  exit /b 1
)
if not exist "styles.css" (
  echo ERROR: styles.css is missing in "%CD%".
  exit /b 1
)

set "PORT=8917"
set "URL=http://127.0.0.1:%PORT%/"

where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell is required to verify the local server.
  exit /b 1
)

rem Exit 0: our site is already running; 1: port is free; 2: another service owns it.
powershell.exe -NoProfile -NonInteractive -Command "$u='%URL%'; try { $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content.Contains('app.js') -and $r.Content.Contains('calculator-view')) { exit 0 } } catch {} $c=[System.Net.Sockets.TcpClient]::new(); try { $c.Connect('127.0.0.1',%PORT%); exit 2 } catch { exit 1 } finally { $c.Dispose() }"
set "STATUS=%errorlevel%"
if "%STATUS%"=="0" (
  echo The project is already running on port %PORT%.
  goto OPEN_PAGE
)
if not "%STATUS%"=="1" (
  echo ERROR: Port %PORT% is occupied by another service, or its status could not be checked.
  exit /b 1
)

rem This is the same successful launch method used for this project.
set "PYTHON="
python -c "import http.server" >nul 2>&1
if not errorlevel 1 set "PYTHON=python"
if not defined PYTHON (
  py -3 -c "import http.server" >nul 2>&1
  if not errorlevel 1 set "PYTHON=py -3"
)
if not defined PYTHON (
  echo ERROR: Python 3 is not installed or cannot be found in PATH.
  exit /b 1
)

echo Starting the project on port %PORT%...
start "Formula server" /MIN %PYTHON% -m http.server %PORT% --bind 127.0.0.1 --directory "%CD%"
if errorlevel 1 (
  echo ERROR: Could not start the Python server.
  exit /b 1
)

rem Wait up to 10 seconds and verify this project's page, not just an open port.
powershell.exe -NoProfile -NonInteractive -Command "$u='%URL%'; for ($i=0; $i -lt 40; $i++) { try { $r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200 -and $r.Content.Contains('app.js') -and $r.Content.Contains('calculator-view')) { exit 0 } } catch {} Start-Sleep -Milliseconds 250 } exit 1"
if errorlevel 1 (
  echo ERROR: The server did not become ready. Check the minimized server window.
  exit /b 1
)

:OPEN_PAGE
echo Web page: %URL%
start "" "%URL%"
if errorlevel 1 (
  echo Open the URL above in your browser.
  exit /b 1
)
exit /b 0
