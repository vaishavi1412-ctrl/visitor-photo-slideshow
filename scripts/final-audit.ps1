# final-audit.ps1
# Read-only check of the Visitor Photo Slideshow project before submission.
# It changes nothing. Run it from the project root (the folder that contains backend and frontend):
#
#   powershell -ExecutionPolicy Bypass -File scripts\final-audit.ps1
#
# A copy of the output is saved in your TEMP folder (the path is printed at the end).

$ErrorActionPreference = 'Continue'
$script:pass = 0
$script:warn = 0
$script:fail = 0

function Section($title) {
  Write-Host ''
  Write-Host ('=== ' + $title + ' ===') -ForegroundColor Cyan
}

function Report($level, $text) {
  if ($level -eq 'PASS') { $script:pass++; Write-Host ('PASS  ' + $text) -ForegroundColor Green }
  elseif ($level -eq 'WARN') { $script:warn++; Write-Host ('WARN  ' + $text) -ForegroundColor Yellow }
  else { $script:fail++; Write-Host ('FAIL  ' + $text) -ForegroundColor Red }
}

$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'backend')) -or -not (Test-Path (Join-Path $root 'frontend'))) {
  Write-Host 'Run this from the project root (the folder that contains backend and frontend).'
  exit 1
}

$report = Join-Path $env:TEMP 'audit-report.txt'
try { Start-Transcript -Path $report | Out-Null } catch { }

function Rel($path) { return $path.Substring($root.Length + 1) }

# ---------------------------------------------------------------- 1
Section '1. Project structure (node_modules, .git, dist and the contents of data and uploads are hidden)'
Get-ChildItem -Path $root -Recurse -Force -File |
  Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|dist)\\' -and $_.FullName -notmatch '\\backend\\(data|uploads)\\' } |
  ForEach-Object { Rel $_.FullName } |
  Sort-Object

# ---------------------------------------------------------------- 2
Section '2. Required files, empty files and missing exports'
$required = @(
  'README.md', 'ASSUMPTIONS.md', 'ARCHITECTURE.md', 'TESTING.md', 'AI_LOG.md', '.gitignore', 'package.json',
  'backend\package.json', 'backend\.env.example', 'backend\src\app.js', 'backend\src\server.js', 'backend\src\db.js',
  'frontend\package.json', 'frontend\vite.config.js', 'frontend\src\App.jsx'
)
foreach ($f in $required) {
  $p = Join-Path $root $f
  if (-not (Test-Path $p)) { Report 'FAIL' ($f + ' is missing') }
  elseif ((Get-Item $p).Length -eq 0) { Report 'FAIL' ($f + ' is EMPTY (0 bytes)') }
  else { Report 'PASS' ($f + ' exists (' + (Get-Item $p).Length + ' bytes)') }
}

$empty = Get-ChildItem -Path $root -Recurse -Force -File |
  Where-Object { $_.Length -eq 0 -and $_.Name -ne '.gitkeep' -and $_.FullName -notmatch '\\(node_modules|\.git)\\' }
if ($empty) {
  foreach ($e in $empty) { Report 'FAIL' ('Empty file: ' + (Rel $e.FullName)) }
} else {
  Report 'PASS' 'No empty files (apart from the .gitkeep files)'
}

$noExport = @()
$components = Get-ChildItem -Path (Join-Path $root 'frontend\src') -Recurse -Filter '*.jsx' |
  Where-Object { $_.Name -notmatch '\.test\.jsx$' -and $_.Name -ne 'main.jsx' }
foreach ($c in $components) {
  if (-not (Select-String -Path $c.FullName -Pattern 'export default|export function|export const' -Quiet)) {
    $noExport += (Rel $c.FullName)
  }
}
if ($noExport.Count -gt 0) {
  foreach ($n in $noExport) { Report 'FAIL' ('No export found in ' + $n) }
} else {
  Report 'PASS' ('All ' + $components.Count + ' React component files have an export')
}

# ---------------------------------------------------------------- 3
Section '3. Documentation: placeholders, escapes, Mermaid blocks, links'
$docs = Get-ChildItem -Path $root -Filter '*.md'
foreach ($d in $docs) {
  $name = $d.Name
  $text = Get-Content -Path $d.FullName -Raw

  $placeholders = Select-String -Path $d.FullName -Pattern '<your-github-username>|<Your name>|TO CONFIRM|TODO|_fill in_|NOT RUN'
  if ($placeholders) {
    Report 'WARN' ($name + ' still has ' + @($placeholders).Count + ' placeholder line(s) to complete:')
    foreach ($p in ($placeholders | Select-Object -First 6)) {
      $line = $p.Line.Trim()
      if ($line.Length -gt 90) { $line = $line.Substring(0, 90) + '...' }
      Write-Host ('      line ' + $p.LineNumber + ': ' + $line)
    }
  } else {
    Report 'PASS' ($name + ' has no placeholders')
  }

  $escapes = Select-String -Path $d.FullName -Pattern '^\s*\\[#>\-\*]', '\\_', '\\\[', '\\\*'
  if ($escapes) {
    Report 'FAIL' ($name + ' has ' + @($escapes).Count + ' line(s) with stray backslashes before Markdown characters')
    foreach ($e in ($escapes | Select-Object -First 5)) { Write-Host ('      line ' + $e.LineNumber + ': ' + $e.Line.Trim()) }
  } else {
    Report 'PASS' ($name + ' has no stray backslash escapes')
  }

  $fenceLines = @(Select-String -Path $d.FullName -Pattern '^\s*```')
  if (($fenceLines.Count % 2) -ne 0) {
    Report 'FAIL' ($name + ' has an unclosed code block (odd number of ``` lines: ' + $fenceLines.Count + ')')
  }
  $mermaid = @(Select-String -Path $d.FullName -Pattern '^\s*```mermaid')
  if ($mermaid.Count -gt 0) {
    Report 'PASS' ($name + ' contains ' + $mermaid.Count + ' Mermaid diagram block(s)')
  }

  foreach ($m in [regex]::Matches($text, '\]\(([^)\s#]+)\)')) {
    $target = $m.Groups[1].Value
    if ($target -match '^(https?:|mailto:)') { continue }
    if (-not (Test-Path (Join-Path $d.DirectoryName $target))) {
      Report 'FAIL' ($name + ' links to a file that does not exist: ' + $target)
    }
  }
}
Write-Host 'Note: this script cannot draw Mermaid diagrams. Check them after pushing (GitHub draws them),'
Write-Host 'or paste the text of one diagram (without the ``` lines) into https://mermaid.live'

$readme = Join-Path $root 'README.md'
if (Test-Path $readme) {
  if (Select-String -Path $readme -Pattern 'Vaishavi Kalpeshbhai Darji' -Quiet) { Report 'PASS' 'README.md names the author' }
  else { Report 'WARN' 'README.md does not contain the author name' }
}

# ---------------------------------------------------------------- 4
Section '4. Git and repository safety'
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Report 'FAIL' 'Git is not installed'
} else {
  $inside = git rev-parse --is-inside-work-tree 2>$null
  if ($inside -ne 'true') {
    Report 'FAIL' 'Git is not initialised here (run: git init)'
  } else {
    Report 'PASS' 'Git repository found'
    $branch = git branch --show-current 2>$null
    Write-Host ('      current branch: ' + $branch)

    $remotes = git remote -v 2>$null
    if ($remotes) {
      Report 'PASS' 'A remote is configured (check that the address below is YOUR repository):'
      $remotes | ForEach-Object { Write-Host ('      ' + $_) }
    } else {
      Report 'WARN' 'No GitHub remote configured yet'
    }

    $count = git rev-list --count HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $count) {
      Report 'FAIL' 'There are no commits yet'
    } elseif ([int]$count -ge 8) {
      Report 'PASS' ($count + ' commits (a meaningful history)')
    } else {
      Report 'WARN' ('Only ' + $count + ' commits. The assignment asks for a meaningful commit history')
    }
    Write-Host '      recent commits:'
    git log --oneline -n 20 2>$null | ForEach-Object { Write-Host ('        ' + $_) }

    $status = git status --short 2>$null
    if ($status) {
      Report 'WARN' 'There are changes that are not committed yet:'
      $status | ForEach-Object { Write-Host ('      ' + $_) }
    } else {
      Report 'PASS' 'Working tree is clean (everything is committed)'
    }

    $tracked = git ls-files
    $bad = foreach ($t in $tracked) {
      if ($t -match '(^|/)\.env$') { $t }
      elseif ($t -match '\.db(-wal|-shm)?$') { $t }
      elseif ($t -match '(^|/)node_modules/') { $t }
      elseif ($t -match '^backend/uploads/' -and $t -notmatch '\.gitkeep$') { $t }
      elseif ($t -match '\.log$') { $t }
    }
    if ($bad) {
      foreach ($b in $bad) { Report 'FAIL' ('Tracked by Git but should not be: ' + $b) }
    } else {
      Report 'PASS' 'No .env, database, node_modules, upload or log files are tracked'
    }

    foreach ($probe in @('backend/.env', 'backend/data/slideshow.db', 'backend/uploads/test.webp', 'node_modules/x', 'frontend/node_modules/x')) {
      git check-ignore -q $probe 2>$null
      if ($LASTEXITCODE -eq 0) { Report 'PASS' ($probe + ' is ignored by Git') }
      else { Report 'FAIL' ($probe + ' is NOT ignored by Git') }
    }

    $envExample = Join-Path $root 'backend\.env.example'
    if (Test-Path $envExample) {
      if (Select-String -Path $envExample -Pattern 'ADMIN_PASSWORD=replace-with' -Quiet) {
        Report 'PASS' 'backend\.env.example keeps a placeholder password'
      } else {
        Report 'FAIL' 'backend\.env.example does not hold the placeholder password: check it for real secrets'
      }
    }

    $envPath = Join-Path $root 'backend\.env'
    if (Test-Path $envPath) {
      $line = Get-Content $envPath | Where-Object { $_ -like 'ADMIN_PASSWORD=*' } | Select-Object -First 1
      if ($line) {
        $pw = $line.Substring(15)
        if ($pw.Length -lt 8 -or $pw -like 'replace-with*') {
          Report 'WARN' 'ADMIN_PASSWORD in backend\.env is missing, too short or still the placeholder'
        } else {
          git grep -q -F -e $pw 2>$null
          if ($LASTEXITCODE -eq 0) { Report 'FAIL' 'The admin password was found in a tracked file' }
          else { Report 'PASS' 'The admin password is not in any tracked file' }

          $history = git log --all --oneline -S"$pw" 2>$null
          if ($history) { Report 'FAIL' 'The admin password appears in the commit history' }
          else { Report 'PASS' 'The admin password is not in the commit history' }
        }
      }
    }

    $generic = git grep -n -i -E "(api[_-]?key|secret|passwd)[[:space:]]*[:=][[:space:]]*['""][A-Za-z0-9_-]{16,}" -- ':!package-lock.json' 2>$null
    if ($generic) {
      Report 'WARN' 'Possible hard-coded secrets, please review:'
      $generic | Select-Object -First 5 | ForEach-Object { Write-Host ('      ' + $_) }
    } else {
      Report 'PASS' 'No obvious hard-coded keys or secrets in tracked files'
    }
  }
}

# ---------------------------------------------------------------- 5
Section '5. Automated tests (npm test from the project root)'
$testOutput = & npm test 2>&1 | Out-String
$testCode = $LASTEXITCODE
($testOutput -split "`r?`n") | Where-Object { $_ -match 'Test Files|^\s*Tests\s|FAIL|failed' } | ForEach-Object { Write-Host ('      ' + $_.Trim()) }
if ($testCode -eq 0) {
  Report 'PASS' 'npm test finished with no failures'
} else {
  Report 'FAIL' 'npm test reported failures. Last lines of the output:'
  ($testOutput -split "`r?`n") | Select-Object -Last 25 | ForEach-Object { Write-Host ('      ' + $_) }
}

# ---------------------------------------------------------------- summary
Section 'Summary'
Write-Host ('PASS: ' + $script:pass + '   WARN: ' + $script:warn + '   FAIL: ' + $script:fail)
if ($script:fail -gt 0) { Write-Host 'Fix the FAIL lines before you push to GitHub.' -ForegroundColor Red }
elseif ($script:warn -gt 0) { Write-Host 'No failures. Read the WARN lines: some are things only you can complete.' -ForegroundColor Yellow }
else { Write-Host 'Everything checked is fine.' -ForegroundColor Green }
Write-Host ('A copy of this output was saved to: ' + $report)
try { Stop-Transcript | Out-Null } catch { }
