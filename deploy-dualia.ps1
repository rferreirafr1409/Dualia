# deploy-dualia.ps1
# Script complet : export web + patchs necessaires + deploiement sur GitHub Pages
# Usage : depuis C:\Users\rferr\dualia-mvp, lancer -> .\deploy-dualia.ps1
$ErrorActionPreference = "Stop"
Write-Host "=== 1/5 : Verification TypeScript ===" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"
$tscOutput = npx tsc --noEmit 2>&1
$ErrorActionPreference = "Stop"

$tscErrors = $tscOutput | Select-String -Pattern "error TS"

if ($tscErrors) {
    Write-Host "ERREURS TYPESCRIPT DETECTEES :" -ForegroundColor Red
    $tscErrors | ForEach-Object { Write-Host $_ }
    Write-Host "Deploiement annule. Corrige les erreurs ci-dessus avant de redeployer." -ForegroundColor Red
    exit 1
}
Write-Host "OK - aucune erreur TypeScript" -ForegroundColor Green

Write-Host "`n=== 2/5 : Export web Expo ===" -ForegroundColor Cyan
npx expo export --platform web
if ($LASTEXITCODE -ne 0) {
    Write-Host "Echec de l'export Expo. Deploiement annule." -ForegroundColor Red
    exit 1
}
Write-Host "OK - export termine dans dist/" -ForegroundColor Green

Write-Host "`n=== 3/5 : Patch .nojekyll ===" -ForegroundColor Cyan
New-Item -Path "dist\.nojekyll" -ItemType File -Force | Out-Null
Write-Host "OK - .nojekyll cree" -ForegroundColor Green

Write-Host "`n=== 4/5 : Patch type module sur TOUS les fichiers HTML ===" -ForegroundColor Cyan
$htmlFiles = Get-ChildItem -Path "dist" -Filter "*.html" -Recurse
$patchedCount = 0
foreach ($file in $htmlFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $before = $content
    $content = $content -replace '(<script src="[^"]*entry-[^"]*\.js")\s+defer(></script>)', '$1 type="module"$2'
    if ($content -ne $before) {
        Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8 -NoNewline
        $patchedCount++
    }
}
Write-Host "OK - $patchedCount fichier(s) HTML patche(s) sur $($htmlFiles.Count) trouve(s)" -ForegroundColor Green

Write-Host "`n=== 5/5 : Deploiement git direct vers gh-pages ===" -ForegroundColor Cyan
Write-Host "(methode git directe car 'npx gh-pages' exclut les dossiers node_modules)" -ForegroundColor DarkGray
Push-Location dist
if (Test-Path ".git") {
    Remove-Item ".git" -Recurse -Force
}
git init | Out-Null
git checkout -b gh-pages | Out-Null
git add -A
git commit -m "Deploy Dualia web build $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
git push --force https://github.com/rferreirafr1409/Dualia.git gh-pages
Pop-Location

Write-Host "`n=== DEPLOIEMENT TERMINE ===" -ForegroundColor Green
Write-Host "Attends 1-2 minutes puis teste sur :" -ForegroundColor Cyan
Write-Host "https://rferreirafr1409.github.io/Dualia/" -ForegroundColor White
Write-Host "`nConseil : teste d'abord en navigation privee (Ctrl+Maj+N) pour eviter le cache." -ForegroundColor DarkGray