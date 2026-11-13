@echo off
setlocal EnableExtensions

cd /d "%~dp0" || (
  echo ERROR: Cannot open the project directory.
  exit /b 1
)
set "FORMULA_ROOT=%CD%"

where powershell.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: PowerShell is required to identify the server process safely.
  exit /b 1
)

rem Only the Python http.server started by start.bat on 127.0.0.1:8917
rem with --directory pointing to this exact project may be stopped.
rem Browsers, parent shells, and unrelated Python processes are left alone.
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; try { $port=8917; $listeners=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue); if ($listeners.Count -eq 0) { Write-Host 'The server is already stopped; port 8917 is free.'; exit 0 }; $local=@($listeners | Where-Object { $_.LocalAddress -eq '127.0.0.1' }); if ($local.Count -ne 1) { Write-Host 'ERROR: Port 8917 is in use, but not by this project server. Nothing was stopped.'; exit 2 }; $ownerId=$local[0].OwningProcess; $server=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ownerId); if ($null -eq $server) { Write-Host 'ERROR: Server process disappeared before verification. Nothing was stopped.'; exit 2 }; $line=$server.CommandLine.Replace([string][char]34,''); $marker='--directory '; $at=$line.LastIndexOf($marker,[StringComparison]::OrdinalIgnoreCase); $valid=($server.Name -ieq 'python.exe') -and ($line -match '(?i)(?:^|\s)-m\s+http\.server\s+8917(?:\s|$)') -and ($line -match '(?i)(?:^|\s)--bind\s+127\.0\.0\.1(?:\s|$)') -and ($at -ge 0); if ($valid) { $actual=[IO.Path]::GetFullPath($line.Substring($at+$marker.Length).Trim()).TrimEnd([char]92); $expected=[IO.Path]::GetFullPath($env:FORMULA_ROOT).TrimEnd([char]92); $valid=[string]::Equals($actual,$expected,[StringComparison]::OrdinalIgnoreCase) }; if (-not $valid) { Write-Host 'ERROR: Port 8917 belongs to another process or project. Nothing was stopped.'; exit 2 }; $current=Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ownerId); $stillListening=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.OwningProcess -eq $ownerId -and $_.LocalAddress -eq '127.0.0.1' }); if ($null -eq $current -or $current.CreationDate -ne $server.CreationDate -or $current.CommandLine -cne $server.CommandLine -or $stillListening.Count -ne 1) { Write-Host 'ERROR: Server identity changed during verification. Nothing was stopped.'; exit 2 }; Stop-Process -Id $ownerId -ErrorAction Stop; for ($i=0; $i -lt 30; $i++) { $remaining=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue); if ($remaining.Count -eq 0) { Write-Host ('Project server stopped (PID ' + $ownerId + '); port 8917 is free.'); exit 0 }; Start-Sleep -Milliseconds 100 }; Write-Host 'ERROR: Port 8917 is still occupied. No other processes were stopped.'; exit 1 } catch { Write-Host ('ERROR: ' + $_.Exception.Message); exit 1 }"
exit /b %errorlevel%
