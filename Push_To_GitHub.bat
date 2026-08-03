@echo off
echo Pushing Cognitive Fatigue Guard to GitHub...
git branch -M main
git push -u origin main
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Code pushed to https://github.com/T58574/cognitive-fatigue-guard
) else (
    echo [ERROR] Push failed. Make sure you created a public repository named 'cognitive-fatigue-guard' on https://github.com/new
)
pause
