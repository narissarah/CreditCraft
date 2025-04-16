@echo off
echo Setting up CreditCraft POS Extension...

REM Install dependencies
echo Installing dependencies...
call npm install

REM Check if Shopify CLI is installed
where shopify >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Shopify CLI not found. Installing...
    call npm install -g @shopify/cli @shopify/app
)

REM Build the extension
echo Building extension...
call npm run build

echo.
echo Setup complete! To run the development server, use:
echo npm run dev
echo.
echo To test the extension in a development store, you'll need to:
echo 1. Register the extension in your Shopify Partner Dashboard
echo 2. Connect it to your development store
echo 3. Use 'shopify app dev' to start the development server
echo 4. Scan the QR code with a device that has Shopify POS installed
echo.
pause 