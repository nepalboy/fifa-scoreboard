# FIFA Scoreboard GitHub Deployment Script
# This script creates a GitHub repository and uploads your project files using GitHub's REST API.
# Run this script using PowerShell: .\deploy_to_github.ps1

$filesToUpload = @("index.html", "index.css", "app.js", "firebase-config.js", "run_local_server.ps1", "README.md", "deploy_to_github.ps1")

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  FIFA SCOREBOARD - GITHUB INITIALIZATION & UPLOAD" -ForegroundColor Gold
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  This script will create a new repository and upload your files."
Write-Host "  No Git installation required!`n"

# 1. Ask for credentials
$username = Read-Host "Enter your GitHub Username"
if ([string]::IsNullOrWhiteSpace($username)) {
    Write-Error "Username cannot be empty."
    exit
}

$repoName = Read-Host "Enter desired Repository Name [default: fifa-scoreboard]"
if ([string]::IsNullOrWhiteSpace($repoName)) {
    $repoName = "fifa-scoreboard"
}

Write-Host "`nYou will need a GitHub Personal Access Token (PAT) with 'repo' permissions." -ForegroundColor Yellow
Write-Host "Create one at: https://github.com/settings/tokens" -ForegroundColor Yellow
$token = Read-Host "Enter your GitHub PAT"
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Error "Personal Access Token is required."
    exit
}

# Setup authorization headers
$headers = @{
    "Authorization"        = "token $token"
    "Accept"               = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

# 2. Check if repo exists, create if not
$repoUrl = "https://api.github.com/repos/$username/$repoName"
$repoCreated = $false

Write-Host "`nChecking if repository '$username/$repoName' exists..." -ForegroundColor Cyan

try {
    $check = Invoke-RestMethod -Uri $repoUrl -Headers $headers -Method Get -ErrorAction Stop
    Write-Host "Repository already exists on GitHub! We will push updates directly to it." -ForegroundColor Yellow
    $repoCreated = $true
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 404) {
        Write-Host "Repository does not exist. Creating repository '$repoName'..." -ForegroundColor Cyan
        
        $body = @{
            name        = $repoName
            description = "FIFA Scoreboard and Tournament Bracket Application"
            private     = $false
            has_issues  = $true
            has_projects= $true
            has_wiki    = $true
        } | ConvertTo-Json

        try {
            $create = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Headers $headers -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop
            Write-Host "Successfully created repository '$repoName' on GitHub!" -ForegroundColor Green
            $repoCreated = $true
        } catch {
            Write-Error "Failed to create repository. Details: $_"
            exit
        }
    } else {
        Write-Error "Failed to connect to GitHub. Please check your token and internet connection. Details: $_"
        exit
    }
}

if ($repoCreated) {
    # 3. Upload files
    Write-Host "`nUploading files..." -ForegroundColor Cyan

    foreach ($file in $filesToUpload) {
        $filePath = Join-Path (Get-Location) $file
        
        if (Test-Path $filePath -PathType Leaf) {
            # Read file bytes and encode to base64
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $base64Content = [System.Convert]::ToBase64String($bytes)
            
            # Check if file already exists in repo to get its SHA (required for updating)
            $fileUrl = "https://api.github.com/repos/$username/$repoName/contents/$file"
            $sha = $null
            
            try {
                $fileCheck = Invoke-RestMethod -Uri $fileUrl -Headers $headers -Method Get -ErrorAction SilentlyContinue
                if ($fileCheck -and $fileCheck.sha) {
                    $sha = $fileCheck.sha
                }
            } catch {
                # File doesn't exist yet, which is fine
            }

            # Prepare payload
            $commitBody = @{
                message = "Upload $file via FIFA Deploy Tool"
                content = $base64Content
            }
            if ($sha) {
                $commitBody.Add("sha", $sha)
            }
            $commitJson = $commitBody | ConvertTo-Json

            # Upload / Update
            try {
                $upload = Invoke-RestMethod -Uri $fileUrl -Headers $headers -Method Put -Body $commitJson -ContentType "application/json" -ErrorAction Stop
                Write-Host "[SUCCESS] Uploaded: $file" -ForegroundColor Green
            } catch {
                Write-Host "[FAILED] Uploading $file: $_" -ForegroundColor Red
            }
        } else {
            Write-Host "[WARNING] File not found, skipping: $file" -ForegroundColor Yellow
        }
    }

    Write-Host "`n========================================================" -ForegroundColor Cyan
    Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Gold
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "  GitHub Repository: https://github.com/$username/$repoName" -ForegroundColor Green
    Write-Host "  To enable free hosting (GitHub Pages):"
    Write-Host "  1. Go to repository Settings > Pages."
    Write-Host "  2. Under Build and deployment, set Source to 'Deploy from a branch'."
    Write-Host "  3. Set Branch to 'main' (or 'master') and folder to '/' (root)."
    Write-Host "  4. Click Save, and your web app will be live in a few minutes!"
    Write-Host "========================================================`n" -ForegroundColor Cyan
}
