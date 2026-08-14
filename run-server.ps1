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
        if ($url -eq "/") { $url = "/index.html" }
        
        # Ruta de archivo física relativa al directorio actual
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
