import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);
const outputFrontmatterOrder = [
  'title',
  'description',
  'pubDate',
  'updatedDate',
  'heroImage',
  'heroAlt',
  'tags',
  'draft',
  'readingTime',
];

function parseArgs(argv) {
  const options = {
    source: process.env.OBSIDIAN_BLOG_SOURCE || 'obsidian/vault/30 Drafts',
    output: process.env.OBSIDIAN_BLOG_OUTPUT || 'src/content/blog',
    assetsOutput: process.env.OBSIDIAN_BLOG_ASSETS_OUTPUT || 'public/images/blog',
    assetsPublicPath: process.env.OBSIDIAN_BLOG_ASSETS_PUBLIC_PATH || '/images/blog',
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const key = arg.slice(2).replaceAll('-', '');
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    i += 1;

    if (key === 'source') options.source = value;
    else if (key === 'output') options.output = value;
    else if (key === 'assetsoutput') options.assetsOutput = value;
    else if (key === 'assetspublicpath') options.assetsPublicPath = value;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    ...options,
    source: path.resolve(root, options.source),
    output: path.resolve(root, options.output),
    assetsOutput: path.resolve(root, options.assetsOutput),
    assetsPublicPath: normalizePublicPath(options.assetsPublicPath),
  };
}

function normalizePublicPath(value) {
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function walkMarkdownFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkMarkdownFiles(entryPath);
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) return [entryPath];
    return [];
  });
}

function walkFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    if (entry.isFile()) return [entryPath];
    return [];
  });
}

function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isUrlOrPublicPath(value) {
  return /^https?:\/\//.test(value) || value.startsWith('/');
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function parseFrontmatterValue(value) {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return JSON.parse(trimmed.replaceAll("'", '"'));
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseMarkdown(raw, file) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error(`${relative(file)} is missing YAML frontmatter.`);
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      throw new Error(`${relative(file)} has invalid frontmatter line: ${line}`);
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1);
    data[key] = parseFrontmatterValue(value);
  }

  return { data, content: match[2] };
}

function formatFrontmatterValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`;
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value !== 'string') return String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\/[a-zA-Z0-9/_\-.]+$/.test(value)) return value;
  if (/^[a-zA-Z0-9/_\-.]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function stringifyMarkdown(content, data) {
  const frontmatter = outputFrontmatterOrder
    .filter((key) => data[key] !== undefined)
    .map((key) => `${key}: ${formatFrontmatterValue(data[key])}`)
    .join('\n');

  return `---\n${frontmatter}\n---\n\n${content.trim()}\n`;
}

function requireField(data, field, file) {
  if (data[field] === undefined || data[field] === null || data[field] === '') {
    throw new Error(`${relative(file)} is missing required frontmatter: ${field}`);
  }
}

function relative(file) {
  return path.relative(root, file).replaceAll('\\', '/');
}

function parseObsidianTarget(target) {
  const [rawPath, rawAlt] = target.split('|');
  const cleanPath = rawPath.split('#')[0].trim();
  const alt = rawAlt?.trim() || path.basename(cleanPath);
  return { cleanPath, alt };
}

function findAsset(target, notePath, sourceRoot, allAssets) {
  const candidates = [
    path.resolve(path.dirname(notePath), target),
    path.resolve(sourceRoot, target),
    path.resolve(sourceRoot, 'assets', target),
  ];

  const found = candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
  if (found) return found;

  const targetBaseName = path.basename(target).toLowerCase();
  return allAssets.find((asset) => path.basename(asset).toLowerCase() === targetBaseName);
}

function copyAsset(assetPath, slug, options) {
  const fileName = path.basename(assetPath);
  const destinationDirectory = path.join(options.assetsOutput, slug);
  const destinationPath = path.join(destinationDirectory, fileName);
  const publicPath = `${options.assetsPublicPath}/${slug}/${fileName}`.replaceAll('\\', '/');

  if (!options.dryRun) {
    mkdirSync(destinationDirectory, { recursive: true });
    copyFileSync(assetPath, destinationPath);
  }

  return publicPath;
}

function normalizeHeroImage(value, notePath, sourceRoot, allAssets, slug, options) {
  if (!value || typeof value !== 'string' || isUrlOrPublicPath(value)) return value;

  const asset = findAsset(value, notePath, sourceRoot, allAssets);
  if (!asset) {
    throw new Error(`${relative(notePath)} references missing heroImage: ${value}`);
  }

  return copyAsset(asset, slug, options);
}

function convertImageEmbeds(content, notePath, sourceRoot, allAssets, slug, options) {
  return content.replace(/!\[\[([^\]]+)\]\]/g, (match, target) => {
    const { cleanPath, alt } = parseObsidianTarget(target);
    const extension = path.extname(cleanPath).toLowerCase();
    if (!imageExtensions.has(extension)) return match;

    const asset = findAsset(cleanPath, notePath, sourceRoot, allAssets);
    if (!asset) {
      throw new Error(`${relative(notePath)} references missing image embed: ${cleanPath}`);
    }

    const publicPath = copyAsset(asset, slug, options);
    return `![${alt}](${publicPath})`;
  });
}

function assertNoWikilinks(content, file) {
  const wikilink = content.match(/!?\[\[[^\]]+\]\]/);
  if (!wikilink) return;

  throw new Error(
    `${relative(file)} still contains "${wikilink[0]}". Use a normal Markdown link before publishing.`,
  );
}

function frontmatterForAstro(data, slug) {
  const normalized = {};
  for (const key of outputFrontmatterOrder) {
    if (data[key] === undefined || data[key] === null || data[key] === '') continue;
    normalized[key] = key.endsWith('Date') || key === 'pubDate' ? normalizeDate(data[key]) : data[key];
  }

  normalized.draft = Boolean(normalized.draft);

  if (!slug) {
    throw new Error('Published Obsidian notes need an ASCII slug in frontmatter or filename.');
  }

  return normalized;
}

function importPost(file, options, allAssets) {
  const raw = readFileSync(file, 'utf8');
  const parsed = parseMarkdown(raw, file);
  const data = parsed.data;

  if (data.publish !== true) return null;
  if (data.draft === true) {
    return {
      skipped: true,
      file,
      reason: 'draft: true',
    };
  }

  for (const field of ['title', 'description', 'pubDate', 'tags']) {
    requireField(data, field, file);
  }

  const slug = slugify(data.slug || path.basename(file, '.md'));
  let content = convertImageEmbeds(parsed.content.trimStart(), file, options.source, allAssets, slug, options);
  assertNoWikilinks(content, file);

  const outputData = frontmatterForAstro(
    {
      ...data,
      heroImage: normalizeHeroImage(data.heroImage, file, options.source, allAssets, slug, options),
    },
    slug,
  );

  const destination = path.join(options.output, `${slug}.md`);
  const serialized = stringifyMarkdown(content, outputData);

  if (!options.dryRun) {
    mkdirSync(options.output, { recursive: true });
    writeFileSync(destination, serialized, 'utf8');
  }

  return { file, destination, slug };
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.source)) {
    throw new Error(`Obsidian source directory does not exist: ${options.source}`);
  }

  const markdownFiles = walkMarkdownFiles(options.source);
  const allAssets = walkFiles(options.source).filter((file) => imageExtensions.has(path.extname(file).toLowerCase()));
  const imported = [];
  const skipped = [];

  for (const file of markdownFiles) {
    const result = importPost(file, options, allAssets);
    if (!result) continue;
    if (result.skipped) skipped.push(result);
    else imported.push(result);
  }

  for (const post of imported) {
    console.log(`Imported ${relative(post.file)} -> ${relative(post.destination)}`);
  }
  for (const post of skipped) {
    console.log(`Skipped ${relative(post.file)} (${post.reason})`);
  }

  console.log(`Imported ${imported.length} post(s).`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
