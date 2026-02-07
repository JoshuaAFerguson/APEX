@echo off
REM APEX Test Directory Cleanup Script (Windows)
REM
REM This script provides cross-platform removal of .apex-test directories,
REM handling cases where the directory doesn't exist and ensuring compatibility
REM with Windows systems.
REM
REM Usage:
REM   scripts\cleanup-test-directory.bat
REM   scripts\cleanup-test-directory.bat "C:\path\to\specific\.apex-test"

setlocal enabledelayedexpansion

REM Function to print colored output (Windows doesn't have easy colors, so we use symbols)
set "INFO_PREFIX=[INFO]"
set "SUCCESS_PREFIX=[OK]"
set "WARNING_PREFIX=[WARN]"
set "ERROR_PREFIX=[ERROR]"

REM Function to remove directory safely
:remove_directory
set "dir_path=%~1"

if not exist "%dir_path%" (
    echo %INFO_PREFIX% Directory does not exist: %dir_path%
    exit /b 0
)

if not exist "%dir_path%\*" (
    echo %WARNING_PREFIX% Path exists but is not a directory: %dir_path%
    exit /b 0
)

echo Removing directory: %dir_path%

REM Try to remove directory with proper error handling
rd /s /q "%dir_path%" >nul 2>&1
if %errorlevel% equ 0 (
    echo %SUCCESS_PREFIX% Successfully removed: %dir_path%
    exit /b 0
) else (
    echo %WARNING_PREFIX% Permission denied - attempting to fix permissions...

    REM Try to fix permissions and remove again
    attrib -r -h -s "%dir_path%\*.*" /s /d >nul 2>&1
    rd /s /q "%dir_path%" >nul 2>&1
    if !errorlevel! equ 0 (
        echo %SUCCESS_PREFIX% Successfully removed after permission fix: %dir_path%
        exit /b 0
    ) else (
        echo %ERROR_PREFIX% Failed to remove %dir_path% due to permission restrictions
        echo %INFO_PREFIX% Manual cleanup may be required for: %dir_path%
        exit /b 1
    )
)

REM Function to find all .apex-test directories
:find_apex_test_directories
set "root_dir=%~1"
set "found_dirs="

REM Use dir command to find .apex-test directories recursively
for /f "delims=" %%i in ('dir /ad /b /s "%root_dir%\.apex-test" 2^>nul') do (
    REM Exclude node_modules and .git directories
    echo %%i | findstr /i "node_modules" >nul || (
        echo %%i | findstr /i "\.git" >nul || (
            if "!found_dirs!"=="" (
                set "found_dirs=%%i"
            ) else (
                set "found_dirs=!found_dirs!;%%i"
            )
        )
    )
)
exit /b 0

REM Main cleanup function
:cleanup_test_directories
for %%i in ("%~dp0") do set "project_root=%%~fi.."

echo 🧹 Starting .apex-test directory cleanup...
echo %INFO_PREFIX% Searching from project root: %project_root%

REM Find all .apex-test directories
call :find_apex_test_directories "%project_root%"

if "!found_dirs!"=="" (
    echo %INFO_PREFIX% No .apex-test directories found.
    exit /b 0
)

REM Count directories and display them
set "dir_count=0"
for %%a in ("!found_dirs:;=" "!") do (
    set /a dir_count+=1
    echo    - %%~a
)

if !dir_count! equ 1 (
    echo 📁 Found !dir_count! .apex-test directory:
) else (
    echo 📁 Found !dir_count! .apex-test directories:
)

REM Remove all found directories
set "error_count=0"
for %%a in ("!found_dirs:;=" "!") do (
    call :remove_directory "%%~a"
    if !errorlevel! neq 0 set /a error_count+=1
)

if !error_count! gtr 0 (
    if !error_count! equ 1 (
        echo %ERROR_PREFIX% Cleanup completed with !error_count! error
    ) else (
        echo %ERROR_PREFIX% Cleanup completed with !error_count! errors
    )
    exit /b 1
) else (
    echo %SUCCESS_PREFIX% Cleanup completed successfully!
    exit /b 0
)

REM Show help function
:show_help
echo 🧹 APEX Test Directory Cleanup Utility (Windows Batch Script)
echo.
echo Usage:
echo   scripts\cleanup-test-directory.bat [options] [path]
echo.
echo Options:
echo   --help, -h, /?  Show this help message
echo   path           Specific .apex-test directory path to remove
echo.
echo Examples:
echo   # Clean up all .apex-test directories in project
echo   scripts\cleanup-test-directory.bat
echo.
echo   # Clean up specific directory
echo   scripts\cleanup-test-directory.bat "C:\path\to\.apex-test"
echo.
echo   # Show help
echo   scripts\cleanup-test-directory.bat --help
echo.
echo Features:
echo   ✅ Windows compatibility
echo   ✅ Handles cases where directory doesn't exist
echo   ✅ Recursive directory removal
echo   ✅ Permission error recovery
echo   ✅ Detailed logging
exit /b 0

REM Main execution
if "%~1"=="--help" goto show_help
if "%~1"=="-h" goto show_help
if "%~1"=="/?" goto show_help

REM Check if specific path was provided
if not "%~1"=="" (
    if not "%~1"=="/?" (
        set "target_path=%~f1"
        echo 🧹 Cleaning up specific directory: !target_path!

        call :remove_directory "!target_path!"
        if !errorlevel! equ 0 (
            echo %SUCCESS_PREFIX% Specific directory cleanup completed successfully!
        ) else (
            echo %ERROR_PREFIX% Specific directory cleanup failed
            exit /b 1
        )
        exit /b 0
    )
)

REM Default: cleanup all directories
call :cleanup_test_directories
if %errorlevel% equ 0 (
    echo.
    echo %SUCCESS_PREFIX% All .apex-test directories have been cleaned up!
) else (
    echo.
    echo %ERROR_PREFIX% Some directories could not be cleaned up. See messages above.
    exit /b 1
)