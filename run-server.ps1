# Servidor Web Estático en PowerShell para probar Magi Reservaciones
$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Start()
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Servidor local iniciado correctamente." -ForegroundColor Green
Write-Host " Abre tu navegador en: http://127.0.0.1:$port/" -ForegroundColor Yellow
Write-Host " Presiona CTRL+C en esta consola para detener el servidor." -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Cyan

# Mapeo de tipos de contenido
function Get-ContentType($filePath) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    switch ($ext) {
        ".html" { return "text/html; charset=utf-8" }
        ".js"   { return "application/javascript; charset=utf-8" }
        ".css"  { return "text/css; charset=utf-8" }
        ".png"  { return "image/png" }
        ".jpg"  { return "image/jpeg" }
        ".jpeg" { return "image/jpeg" }
        ".gif"  { return "image/gif" }
        ".svg"  { return "image/svg+xml" }
        ".json" { return "application/json; charset=utf-8" }
        default { return "application/octet-stream" }
    }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $url = $request.Url.LocalPath
        
        # 1. Endpoint POST para guardar la metadata del local
        if ($request.HttpMethod -eq "POST" -and ($url -eq "/api/save-metadata" -or $url -eq "/api/save-metadata/")) {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $reader.Close()
            
            $metaPath = Join-Path $PSScriptRoot "metadata.json"
            $body | Out-File -FilePath $metaPath -Encoding utf8
            
            $response.StatusCode = 200
            $response.ContentType = "application/json; charset=utf-8"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes('{"success":true}')
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }
        
        # 2. Interceptar peticiones a la raíz index.html para inyección dinámica de meta tags
        if ($url -eq "/" -or $url -eq "/index.html" -or $url -eq "/index.html/") {
            $filePath = Join-Path $PSScriptRoot "index.html"
            $html = [System.IO.File]::ReadAllText($filePath)
            
            $query = $request.Url.Query
            $localId = ""
            if ($query -match "local=([^&]+)") { $localId = $Matches[1] }
            elseif ($query -match "sucursal=([^&]+)") { $localId = $Matches[1] }
            
            if ($localId) {
                $metaPath = Join-Path $PSScriptRoot "metadata.json"
                $bizName = "Magi Reservaciones"
                $bizTagline = "Reserva tu sesión de baile Pump It Up"
                $bizImg = "https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=600"
                
                if (Test-Path $metaPath) {
                    try {
                        $metaData = Get-Content -Raw -Path $metaPath | ConvertFrom-Json
                        $biz = $null
                        # Buscar el negocio por ID
                        if ($metaData.Count -gt 1) {
                            $biz = $metaData | Where-Object { $_.id -eq $localId }
                        } else {
                            if ($metaData.id -eq $localId) { $biz = $metaData }
                        }
                        
                        if ($biz -and $biz.name) {
                            $bizName = $biz.name
                            $bizTagline = "Reserva en " + $biz.name + " (" + $biz.tagline + ")"
                            if ($biz.imageUrl) { $bizImg = $biz.imageUrl }
                        }
                    } catch {}
                }
                
                # Reemplazo de tags
                $html = $html -replace "<title>.*?</title>", "<title>$bizName</title>"
                $html = $html -replace '<meta property="og:title" content=".*?"\s*/?>', "<meta property=`"og:title`" content=`"$bizName`" />"
                $html = $html -replace '<meta property="og:description" content=".*?"\s*/?>', "<meta property=`"og:description`" content=`"$bizTagline`" />"
                $html = $html -replace '<meta property="og:image" content=".*?"\s*/?>', "<meta property=`"og:image`" content=`"$bizImg`" />"
            }
            
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }

        if ($url -eq "/") { $url = "/index.html" }
        $urlClean = $url.TrimStart('/')
        $filePath = Join-Path $PSScriptRoot $urlClean
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = Get-ContentType $filePath
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $url")
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $response.Close()
    }
} catch {
    # Evitar imprimir errores al abortar con Ctrl+C
} finally {
    $listener.Stop()
}
