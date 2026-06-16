# FIFA Scoreboard Local Development Server
# Run this script using PowerShell: .\run_local_server.ps1

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  FIFA SCOREBOARD - LOCAL SERVER RUNNING" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Serving files from: $(Get-Location)"
Write-Host "  Open your browser at: http://localhost:$port/" -ForegroundColor Green
Write-Host "  Press [Ctrl+C] or close this window to stop the server."
Write-Host "========================================================`n" -ForegroundColor Cyan

try {
    $listener.Start()
} catch {
    Write-Error "Failed to start server. Port $port might already be in use. Details: $_"
    exit
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath
        # Default document
        if ($urlPath -eq "/") { 
            $urlPath = "/index.html" 
        }
        
        # Resolve target file path securely
        $relativePath = $urlPath.TrimStart('/')
        $filePath = Join-Path (Get-Location) $relativePath
        
        # Force security check to prevent directory traversal
        $currentDir = (Get-Item .).FullName
        $targetFileItem = Get-Item -ErrorAction SilentlyContinue $filePath
        
        if ($targetFileItem -and $targetFileItem.FullName.StartsWith($currentDir) -and (Test-Path $filePath -PathType Leaf)) {
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            
            # Map proper MIME Types (Critical for browser ES Modules execution)
            $mimeType = switch ($extension) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                ".json" { "application/json; charset=utf-8" }
                Default { "application/octet-stream" }
            }

            try {
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentType = $mimeType
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "[200] Served: $urlPath (Mime: $mimeType)" -ForegroundColor Gray
            } catch {
                $response.StatusCode = 500
                $html = "<html><body><h1>500 Internal Server Error</h1><p>$($_)</p></body></html>"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
                $response.ContentType = "text/html; charset=utf-8"
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                Write-Host "[500] Error reading: $urlPath - $_" -ForegroundColor Red
            }
        } else {
            # File not found
            $response.StatusCode = 404
            $html = "<html><head><style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:3rem;text-align:center;}h1{color:#38bdf8;}p{color:#94a3b8;}</style></head><body><h1>404 Not Found</h1><p>The file '$urlPath' could not be found on the server.</p></body></html>"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
            $response.ContentType = "text/html; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[404] Not Found: $urlPath" -ForegroundColor Yellow
        }
        $response.Close()
    }
} catch [System.Management.Automation.PipelineStoppedException] {
    # Expected when loop is cancelled with Ctrl+C
} catch {
    Write-Host "Server encountered an error: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host "`nWeb server stopped." -ForegroundColor Yellow
}
