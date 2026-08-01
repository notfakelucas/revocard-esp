const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://activocredpt.com';

const htmlPages = [
  'index.html',
  'antibot.html',
  '2.html',
  '3.html',
  '4.html',
  '5.html',
  '6.html',
  '7.html',
  '8.html',
  '9.html',
  'ingrid.html',
  'chat.html',
  'aprovado.html',
  'selfie.html',
  'termos.html',
  'vencimento.html',
  'configurando-conta.html',
  'conta.html',
  'upsells/1/index.html',
  'upsells/2/index.html',
  'upsells/3/index.html',
  'upsells/4/index.html',
  'upsells/5/index.html',
  'upsells/6/index.html'
];

const downloadedAssets = new Set();

// Function to calculate relative prefix based on depth of target HTML file
function getRelativePrefix(filePath) {
  const parts = filePath.split('/');
  if (parts.length <= 1) return '';
  return '../'.repeat(parts.length - 1);
}

// Function to download a file and save it
async function downloadFile(url, destPath) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) {
      console.error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(destPath, buffer);
    console.log(`Downloaded: ${url} -> ${destPath}`);
    return true;
  } catch (error) {
    console.error(`Error downloading ${url}:`, error.message);
    return false;
  }
}

// Process an asset link: clean it, queue for download, and return the rewritten relative URL
function processAsset(assetUrl, pagePath, assetQueue) {
  // Ignore external CDNs, mailto:, tel:, hashes, and data URIs
  if (/^(https?:)?\/\//i.test(assetUrl) && !assetUrl.startsWith(BASE_URL)) {
    return assetUrl; // Keep external as is
  }
  if (assetUrl.startsWith('data:') || assetUrl.startsWith('#') || assetUrl.startsWith('mailto:') || assetUrl.startsWith('tel:')) {
    return assetUrl;
  }

  // Clean url (remove query params / hash)
  let cleanAssetPath = assetUrl.split('?')[0].split('#')[0];
  
  // If it starts with BASE_URL, make it root-relative
  if (cleanAssetPath.startsWith(BASE_URL)) {
    cleanAssetPath = cleanAssetPath.substring(BASE_URL.length);
  }

  let absoluteAssetPath;
  if (cleanAssetPath.startsWith('/')) {
    absoluteAssetPath = cleanAssetPath.substring(1);
  } else {
    const pageDir = path.posix.dirname(pagePath);
    absoluteAssetPath = path.posix.join(pageDir, cleanAssetPath);
  }
  
  // Normalize path
  absoluteAssetPath = path.posix.normalize(absoluteAssetPath);
  if (absoluteAssetPath.startsWith('../')) {
    return assetUrl; // Outside project root, leave as is
  }

  // Add to asset queue if not already downloaded
  if (absoluteAssetPath && !downloadedAssets.has(absoluteAssetPath)) {
    assetQueue.push(absoluteAssetPath);
    downloadedAssets.add(absoluteAssetPath);
  }

  // Calculate relative path from pagePath to absoluteAssetPath
  const prefix = getRelativePrefix(pagePath);
  return prefix + absoluteAssetPath;
}

async function main() {
  const assetQueue = [];

  for (const page of htmlPages) {
    console.log(`\n--- Processing page: ${page} ---`);
    let fetchUrl = `${BASE_URL}/${page}`;
    if (page.endsWith('/index.html')) {
      // Fetch the directory path directly
      fetchUrl = `${BASE_URL}/${page.substring(0, page.length - 10)}`;
    }

    try {
      const res = await fetch(fetchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!res.ok) {
        console.error(`Failed to fetch page ${fetchUrl}: ${res.status}`);
        continue;
      }

      let html = await res.text();

      // Regexes to find assets and replace them with relative paths
      // 1. <link ... href="..."
      html = html.replace(/(<link[^>]+href=["'])([^"']+)((?=["']))/gi, (match, p1, p2) => {
        const rewritten = processAsset(p2, page, assetQueue);
        return p1 + rewritten;
      });

      // 2. <script ... src="..."
      html = html.replace(/(<script[^>]+src=["'])([^"']+)((?=["']))/gi, (match, p1, p2) => {
        const rewritten = processAsset(p2, page, assetQueue);
        return p1 + rewritten;
      });

      // 3. <img ... src="..."
      html = html.replace(/(<img[^>]+src=["'])([^"']+)((?=["']))/gi, (match, p1, p2) => {
        const rewritten = processAsset(p2, page, assetQueue);
        return p1 + rewritten;
      });

      // 4. CSS url(...) inside style tags only
      html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (match, p1, p2, p3) => {
        const rewrittenStyle = p2.replace(/url\(['"]?([^'")]+)['"]?\)/gi, (m, urlPath) => {
          const rewritten = processAsset(urlPath, page, assetQueue);
          return `url("${rewritten}")`;
        });
        return p1 + rewrittenStyle + p3;
      });

      // 5. CSS url(...) inside style="..." attributes
      html = html.replace(/(\sstyle=["'])([^"']*)(["'])/gi, (match, p1, p2, p3) => {
        const rewrittenAttr = p2.replace(/url\(['"]?([^'")]+)['"]?\)/gi, (m, urlPath) => {
          const rewritten = processAsset(urlPath, page, assetQueue);
          return `url("${rewritten}")`;
        });
        return p1 + rewrittenAttr + p3;
      });

      // Save rewritten HTML file
      const localDest = path.join(__dirname, page);
      const dir = path.dirname(localDest);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localDest, html);
      console.log(`Saved HTML: ${page}`);
    } catch (err) {
      console.error(`Error processing page ${page}:`, err.message);
    }
  }

  // Now download all queued assets
  console.log(`\n=== Starting asset downloads. Total unique assets queued: ${assetQueue.length} ===`);
  for (const asset of assetQueue) {
    const downloadUrl = `${BASE_URL}/${asset}`;
    const destPath = path.join(__dirname, asset);
    const success = await downloadFile(downloadUrl, destPath);

    // If it's a CSS file and downloaded successfully, parse it for nested urls (fonts, images)
    if (success && asset.endsWith('.css')) {
      try {
        let cssContent = fs.readFileSync(destPath, 'utf8');
        const cssAssets = [];

        cssContent.replace(/url\(['"]?([^'")]+)['"]?\)/gi, (match, p1) => {
          if (p1.startsWith('data:') || p1.startsWith('http') || p1.startsWith('//')) {
            return match;
          }
          // The p1 is relative to the CSS file itself. Convert to root-relative path to download
          const cssDir = path.dirname(asset);
          const absoluteAssetPath = path.posix.join(cssDir, p1.split('?')[0].split('#')[0]);
          const normalized = path.posix.normalize(absoluteAssetPath);
          
          if (normalized && !normalized.startsWith('../') && !downloadedAssets.has(normalized)) {
            cssAssets.push(normalized);
            downloadedAssets.add(normalized);
          }
          return match;
        });

        if (cssAssets.length > 0) {
          console.log(`Found ${cssAssets.length} nested assets in CSS: ${asset}`);
          for (const cssAsset of cssAssets) {
            const nestedDownloadUrl = `${BASE_URL}/${cssAsset}`;
            const nestedDestPath = path.join(__dirname, cssAsset);
            await downloadFile(nestedDownloadUrl, nestedDestPath);
          }
        }
      } catch (err) {
        console.error(`Error parsing CSS file ${asset}:`, err.message);
      }
    }
  }

  console.log('\n=== Backup process completed successfully! ===');
}

main().catch(console.error);
