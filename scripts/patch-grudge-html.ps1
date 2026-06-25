# Patch Grudge Studio production HTML entry points with fleet bootstrap + notranslate
param(
  [string[]]$Roots = @(
    "C:\Users\nugye\.grok\worktrees\github-grudanode\The-ENGINE\client",
    "C:\Users\nugye\.grok\worktrees\github-grudanode\The-ENGINE",
    "D:\GitHub\voxgrudge",
    "D:\GitHub\GrudgeWarlords",
    "D:\GitHub\grudox",
    "D:\GitHub\GCS",
    "D:\GitHub\grudge-metaverse",
    "D:\GitHub\grudge-game-editor",
    "D:\GitHub\Grudge-Engine-Web",
    "D:\GitHub\grudgedot-launcher",
    "D:\GitHub\grudge-games",
    "D:\GitHub\grudge-platform",
    "D:\GitHub\The-ENGINE",
    "C:\Users\nugye\.grok\worktrees\github-grudanode\RTS-Grudge",
    "C:\Users\nugye\.grok\worktrees\github-grudanode\grudachain\public"
  )
)

$BootstrapTag = '<script src="https://client.grudge-studio.com/grudge-game-bootstrap.js"></script>'
$BootstrapLocal = '<script src="/grudge-game-bootstrap.js"></script>'
$NotranslateMeta = '<meta name="google" content="notranslate" />'
$SkipDirs = '(node_modules|dist|build|\.git|extracted_games|three-js-basic-character-customisation)'

function Should-Skip([string]$path) {
  return $path -match $SkipDirs
}

function Patch-Html([string]$file) {
  $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
  if ($content -notmatch '<html') { return $false }
  $changed = $false

  if ($content -notmatch 'translate\s*=\s*"no"') {
    $content = $content -replace '<html([^>]*)\s+lang="([^"]*)"([^>]*)>', '<html$1 lang="$2" translate="no"$3>'
    $content = $content -replace '<html([^>]*)>', '<html translate="no"$1>'
    $changed = $true
  }

  if ($content -notmatch 'content="notranslate"') {
    if ($content -match '(<meta\s+charset[^>]*>)') {
      $content = $content -replace '(<meta\s+charset[^>]*>)', "`$1`n    $NotranslateMeta"
    } elseif ($content -match '(<head[^>]*>)') {
      $content = $content -replace '(<head[^>]*>)', "`$1`n    $NotranslateMeta"
    }
    $changed = $true
  }

  $hasBootstrap = $content -match 'grudge-game-bootstrap\.js'
  if (-not $hasBootstrap) {
    if ($file -match 'The-ENGINE\\client' -or $file -match 'The-ENGINE\\client') {
      $inject = $BootstrapLocal
    } else {
      $inject = $BootstrapTag
    }
    if ($content -match '(<meta\s+name="google"\s+content="notranslate"[^>]*>)') {
      $content = $content -replace '(<meta\s+name="google"\s+content="notranslate"[^>]*>)', "`$1`n    $inject"
    } elseif ($content -match '(<head[^>]*>)') {
      $content = $content -replace '(<head[^>]*>)', "`$1`n    $inject"
    }
    $changed = $true
  }

  if ($changed) {
    Set-Content -LiteralPath $file -Value $content -Encoding UTF8 -NoNewline
    Write-Host "Patched: $file"
    return $true
  }
  return $false
}

$patched = 0
foreach ($root in $Roots) {
  if (-not (Test-Path $root)) { Write-Host "Skip missing: $root"; continue }
  $files = Get-ChildItem -LiteralPath $root -Recurse -Filter '*.html' -File -ErrorAction SilentlyContinue |
    Where-Object { -not (Should-Skip $_.FullName) }

  foreach ($f in $files) {
    $rel = $f.FullName
    # Only patch likely entry points (root-level or public/ or client/ or games/)
    if ($rel -notmatch '(\\public\\|\\client\\|^[^\\]+\.html$|\\games\\|grudge-.*\.html$|index\.html$)') { continue }
    if (Patch-Html $rel) { $patched++ }
  }
}

Write-Host "Done. Patched $patched files."