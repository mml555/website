const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Create a simple icon with a solid color and text
async function createIcon(size) {
  // Create a base image with the brand color
  const base = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 79, g: 70, b: 229, alpha: 1 } // #4f46e5
    }
  });

  // For larger icons, add text
  if (size >= 180) {
    const text = Buffer.from(
      `<svg>
        <text x="50%" y="50%" font-family="Arial" font-size="${size/4}px" fill="white" text-anchor="middle" dominant-baseline="middle">E-Store</text>
      </svg>`
    );

    return base
      .composite([{
        input: text,
        blend: 'over'
      }])
      .png()
      .toBuffer();
  }

  return base.png().toBuffer();
}

// Ensure the icons directory exists
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate icons of different sizes
const sizes = [16, 32, 180, 192, 512];
const iconNames = {
  16: 'favicon-16x16.png',
  32: 'favicon-32x32.png',
  180: 'apple-touch-icon.png',
  192: 'android-chrome-192x192.png',
  512: 'android-chrome-512x512.png'
};

// Generate all icons
async function generateIcons() {
  for (const size of sizes) {
    try {
      const iconBuffer = await createIcon(size);
      const outputPath = path.join(iconsDir, iconNames[size]);
      fs.writeFileSync(outputPath, iconBuffer);
      console.log(`Generated ${iconNames[size]}`);
    } catch (error) {
      console.error(`Error generating ${iconNames[size]}:`, error);
    }
  }
}

generateIcons().catch(console.error); 