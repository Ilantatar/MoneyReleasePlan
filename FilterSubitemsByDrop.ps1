# Rebuilds index.html: each drop column shows only sub-items tagged for that drop (from git 887caa1^).
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

function Get-SectionSpans([string]$html) {
  $list = [System.Collections.Generic.List[object]]::new()
  $idx = 0
  while ($true) {
    $start = $html.IndexOf('<section class="drop"', $idx)
    if ($start -lt 0) { break }
    $h2open = $html.IndexOf('<h2>', $start)
    if ($h2open -lt 0) { break }
    $h2close = $html.IndexOf('</h2>', $h2open)
    $h2 = $html.Substring($h2open + 4, $h2close - $h2open - 4)
    if ($h2 -notmatch '(V\d)') { $idx = $start + 20; continue }
    $drop = $Matches[1]
    $end = $html.IndexOf('</section>', $start)
    if ($end -lt 0) { break }
    $list.Add([pscustomobject]@{ Drop = $drop; Start = $start; End = $end + 10 }) | Out-Null
    $idx = $end + 10
  }
  return $list
}

function Get-FeatureBlocks([string]$secHtml) {
  $blocks = [System.Collections.Generic.List[string]]::new()
  $p = 0
  while ($true) {
    $s = $secHtml.IndexOf('<details class="feature">', $p)
    if ($s -lt 0) { break }
    $e = $secHtml.IndexOf('</details>', $s)
    if ($e -lt 0) { break }
    $blocks.Add($secHtml.Substring($s, $e + 10 - $s)) | Out-Null
    $p = $e + 10
  }
  return $blocks
}

function Get-SubitemsInnerBounds([string]$detailBlock) {
  $mark = '<div class="subitems">'
  $i = $detailBlock.IndexOf($mark)
  if ($i -lt 0) { return $null }
  $innerStart = $i + $mark.Length
  $suffix = '</div></div></div></details>'
  $j = $detailBlock.LastIndexOf($suffix)
  if ($j -lt $innerStart) { return $null }
  return [pscustomobject]@{ InnerStart = $innerStart; SuffixStart = $j }
}

function Split-SubitemChunks([string]$inner) {
  $chunks = [System.Collections.Generic.List[string]]::new()
  $search = '<div class="subitem">'
  $pos = 0
  while ($true) {
    $a = $inner.IndexOf($search, $pos)
    if ($a -lt 0) { break }
    $b = $inner.IndexOf($search, $a + $search.Length)
    if ($b -lt 0) {
      $chunks.Add($inner.Substring($a)) | Out-Null
      break
    }
    $chunks.Add($inner.Substring($a, $b - $a)) | Out-Null
    $pos = $b
  }
  return $chunks
}

function Test-SubitemInDrop([string]$dropBadge, [string]$sectionDrop) {
  $parts = @($dropBadge.Trim() -split ',' | ForEach-Object { $_.Trim() })
  foreach ($p in $parts) {
    if ($p -eq $sectionDrop) { return $true }
  }
  return $false
}

function New-SubitemHtml([string]$chunk) {
  $nm = if ($chunk -match 'subitem-name">([^<]*)</div>') { $Matches[1] } else { return $null }
  if ($chunk -notmatch 'subitem-badges"><span class="badge (status-[a-z-]+)">([^<]+)</span>') { return $null }
  $cls = $Matches[1]
  $st = $Matches[2]
  return "<div class=`"subitem`"><div class=`"subitem-top`"><div class=`"subitem-name`">$nm</div><div class=`"subitem-badges`"><span class=`"badge $cls`">$st</span></div></div></div>"
}

function Build-FilterMap([string]$oldHtml) {
  $map = @{}
  foreach ($span in (Get-SectionSpans $oldHtml)) {
    $secHtml = $oldHtml.Substring($span.Start, $span.End - $span.Start)
    foreach ($fb in (Get-FeatureBlocks $secHtml)) {
      if ($fb -notmatch 'feature-title">([^<]+)</span>') { continue }
      $title = $Matches[1]
      $bounds = Get-SubitemsInnerBounds $fb
      if ($null -eq $bounds) { continue }
      $inner = $fb.Substring($bounds.InnerStart, $bounds.SuffixStart - $bounds.InnerStart)
      $key = "$($span.Drop)|$title"
      $filtered = [System.Text.StringBuilder]::new()
      foreach ($ch in (Split-SubitemChunks $inner)) {
        if ($ch -notmatch 'drop-badge">([^<]+)</span>') { continue }
        $badge = $Matches[1]
        if (-not (Test-SubitemInDrop $badge $span.Drop)) { continue }
        $nh = New-SubitemHtml $ch
        if ($nh) { [void]$filtered.Append($nh) }
      }
      $map[$key] = $filtered.ToString()
    }
  }
  return $map
}

function Transform-FeatureBlock([string]$block, [string]$drop, [hashtable]$map) {
  if ($block -notmatch 'feature-title">([^<]+)</span>') { return $block }
  $title = $Matches[1]
  $key = "$drop|$title"
  if (-not $map.ContainsKey($key)) { return $block }

  $bounds = Get-SubitemsInnerBounds $block
  if ($null -eq $bounds) { return $block }

  $filtered = $map[$key]
  if ([string]::IsNullOrEmpty($filtered)) {
    # No sub-items for this drop: collapse to summary-only (same as features without children)
    if ($block -match '(?s)^(.*?</summary>)') {
      return $Matches[1] + '</details>'
    }
    return $block
  }

  $prefix = $block.Substring(0, $bounds.InnerStart)
  $suffix = $block.Substring($bounds.SuffixStart)
  return $prefix + $filtered + $suffix
}

function Transform-SectionHtml([string]$secHtml, [string]$drop, [hashtable]$map) {
  $sb = [System.Text.StringBuilder]::new()
  $p = 0
  while ($true) {
    $s = $secHtml.IndexOf('<details class="feature">', $p)
    if ($s -lt 0) {
      [void]$sb.Append($secHtml.Substring($p))
      break
    }
    [void]$sb.Append($secHtml.Substring($p, $s - $p))
    $e = $secHtml.IndexOf('</details>', $s)
    $block = $secHtml.Substring($s, $e + 10 - $s)
    $p = $e + 10
    [void]$sb.Append((Transform-FeatureBlock $block $drop $map))
  }
  return $sb.ToString()
}

$oldPath = Join-Path $env:TEMP "idx_old.html"
if (-not (Test-Path $oldPath)) {
  git show '887caa1^:index.html' | Set-Content -Path $oldPath -Encoding UTF8
}
$oldHtml = [System.IO.File]::ReadAllText($oldPath)
$curPath = Join-Path $repo "index.html"
$html = [System.IO.File]::ReadAllText($curPath)

$map = Build-FilterMap $oldHtml
$out = [System.Text.StringBuilder]::new()
$glob = 0
foreach ($span in (Get-SectionSpans $html)) {
  [void]$out.Append($html.Substring($glob, $span.Start - $glob))
  $sec = $html.Substring($span.Start, $span.End - $span.Start)
  [void]$out.Append((Transform-SectionHtml $sec $span.Drop $map))
  $glob = $span.End
}
[void]$out.Append($html.Substring($glob))

$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($curPath, $out.ToString(), $utf8)
Write-Output "Applied per-drop sub-items ($($map.Count) keys from historical export)."
