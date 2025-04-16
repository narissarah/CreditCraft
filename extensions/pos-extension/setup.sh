#!/bin/bash
echo "Setting up CreditCraft POS Extension..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if Shopify CLI is installed
if ! command -v shopify &> /dev/null
then
    echo "Shopify CLI not found. Installing..."
    npm install -g @shopify/cli @shopify/app
fi

# Build the extension
echo "Building extension..."
npm run build

echo "Setup complete! To run the development server, use:"
echo "npm run dev"
echo ""
echo "To test the extension in a development store, you'll need to:"
echo "1. Register the extension in your Shopify Partner Dashboard"
echo "2. Connect it to your development store"
echo "3. Use 'shopify app dev' to start the development server"
echo "4. Scan the QR code with a device that has Shopify POS installed" 