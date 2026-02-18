// Script to generate test images for screenshot comparison tests
// This should be run manually to create test fixtures

const sharp = require('sharp');
const fs = require('fs/promises');
const path = require('path');

async function generateTestImages() {
  const fixturesDir = __dirname;

  // Create identical images (100x100, red background)
  const redImage = sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).png();

  await redImage.toFile(path.join(fixturesDir, 'red-100x100.png'));
  await redImage.toFile(path.join(fixturesDir, 'red-100x100-copy.png'));

  // Create slightly different image (red with small blue dot)
  const redWithDot = await sharp(path.join(fixturesDir, 'red-100x100.png'))
    .composite([{
      input: await sharp({
        create: {
          width: 5,
          height: 5,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      }).png().toBuffer(),
      top: 10,
      left: 10
    }])
    .png()
    .toFile(path.join(fixturesDir, 'red-with-blue-dot.png'));

  // Create completely different image (blue background)
  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 0, g: 0, b: 255 }
    }
  }).png().toFile(path.join(fixturesDir, 'blue-100x100.png'));

  // Create different size image
  await sharp({
    create: {
      width: 200,
      height: 200,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).png().toFile(path.join(fixturesDir, 'red-200x200.png'));

  // Create RGBA image with transparency
  await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 }
    }
  }).png().toFile(path.join(fixturesDir, 'red-transparent.png'));

  console.log('Test images generated successfully!');
}

if (require.main === module) {
  generateTestImages().catch(console.error);
}

module.exports = { generateTestImages };