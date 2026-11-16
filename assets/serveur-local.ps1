# Petit serveur local pour tester le kit sur un ordinateur Windows. NE PAS MODIFIER.
# Lance par "Lancer-en-local-Windows.bat". Fermer la fenetre pour arreter.
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'
  '.css'='text/css; charset=utf-8'; '.txt'='text/plain; charset=utf-8'; '.json'='application/json; charset=utf-8'
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.svg'='image/svg+xml'
  '.webp'='image/webp'; '.ico'='image/x-icon'; '.pdf'='application/pdf'; '.mp4'='video/mp4'
  '.doc'='application/msword'; '.docx'='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  '.xlsx'='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
}
$listener = $null
foreach ($port in 8765..8785) {
  try { $l = New-Object System.Net.HttpListener; $l.Prefixes.Add("http://localhost:$port/"); $l.Start(); $listener = $l; break } catch { }
}
if (-not $listener) { Write-Host 'Impossible de demarrer : ports 8765 a 8785 occupes.'; Read-Host 'Appuyez sur Entree'; exit 1 }
$url = "http://localhost:$port/"
Write-Host ''
Write-Host "  Kit ouvert sur $url"
Write-Host '  Laissez cette fenetre ouverte pendant l''utilisation. Fermez-la pour arreter.'
Write-Host ''
Start-Process ($url + 'index.html')
while ($listener.IsListening) {
  $ctx = $listener.GetContext(); $req = $ctx.Request; $res = $ctx.Response
  try {
    $res.Headers.Add('Cache-Control', 'no-store')
    $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '' -or $rel.EndsWith('/')) { $rel = $rel + 'index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    if (-not $path.StartsWith($root + '\')) { $res.StatusCode = 403 }
    elseif (Test-Path -LiteralPath $path -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = 'application/octet-stream' }
      $res.ContentType = $ct
      $bytes = [IO.File]::ReadAllBytes($path)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else { $res.StatusCode = 404 }
  } catch { try { $res.StatusCode = 500 } catch { } }
  finally { try { $res.Close() } catch { } }
}
