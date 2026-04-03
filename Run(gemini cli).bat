@echo off
setlocal
echo ======================================================
echo  ROBLOX MCP REMAKE - SETUP ^& UPDATE
echo ======================================================

echo.
echo [1/3] Updating dependencies...
call npm install --silent

echo.
echo [2/3] Building local packages...
call npm run build:all

echo.
echo [3/3] Syncing local files...
echo Done!

echo.
echo ======================================================
echo  SETUP COMPLETE!
echo ======================================================
echo.
echo To apply local fixes in Gemini CLI, run:
echo.
echo gemini mcp add robloxstudio node --trust -- %cd%\packages\robloxstudio-mcp\dist\index.js
echo.
echo To update the Roblox Plugin in Studio, run:
echo node packages\robloxstudio-mcp\dist\index.js --install-plugin
echo.
echo After that, start the server normally in Gemini CLI.
echo.
call gemini
pause
endlocal
