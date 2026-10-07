# deploy-dualia.ps1
# Script complet : export web + patchs necessaires + deploiement sur GitHub Pages
# Usage : depuis C:\Users\rferr\dualia-mvp
#   .\deploy-dualia.ps1                 -> production  (https://rferreirafr1409.github.io/Dualia/)
#   .\deploy-dualia.ps1 -Cible preprod  -> pre-prod    (https://rferreirafr1409.github.io/Dualia/preprod/)
#
# La branche gh-pages porte les deux environnements : la prod a la racine, la
# pre-prod dans le dossier preprod/. Chaque cible ne remplace QUE sa partie ;
# aucun push force, rien n'efface l'autre environnement.
param(
    [ValidateSet("prod", "preprod")]
    [string]$Cible = "prod"
)
$ErrorActionPreference = "Stop"

$depot = "https://github.com/rferreirafr1409/Dualia.git"
if ($Cible -eq "preprod") {
    $urlCible = "https://rferreirafr1409.github.io/Dualia/preprod/"
} else {
    $urlCible = "https://rferreirafr1409.github.io/Dualia/"
}

# La prod ne part que de main : deployer en prod depuis la branche preprod
# publierait du code qui n'a pas ete fusionne.
$brancheCourante = (git rev-parse --abbrev-ref HEAD).Trim()
if ($Cible -eq "prod" -and $brancheCourante -ne "main") {
    Write-Host "Deploiement prod refuse : tu es sur la branche '$brancheCourante', la prod ne part que de 'main'." -ForegroundColor Red
    Write-Host "Pour la pre-prod : .\deploy-dualia.ps1 -Cible preprod" -ForegroundColor Yellow
    exit 1
}

# Lu a la compilation par app.config.js et constants/environnement.ts.
$env:EXPO_PUBLIC_ENV = $Cible
Write-Host "Cible : $Cible (branche $brancheCourante)" -ForegroundColor Magenta

Write-Host "`n=== 1/5 : Verification TypeScript ===" -ForegroundColor Cyan

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

Write-Host "`n=== 2/5 : Export web Expo ($Cible) ===" -ForegroundColor Cyan
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

Write-Host "`n=== 5/5 : Deploiement git vers gh-pages ($Cible) ===" -ForegroundColor Cyan
Write-Host "(methode git directe car 'npx gh-pages' exclut les dossiers node_modules)" -ForegroundColor DarkGray

# On part de la branche gh-pages telle qu'elle est en ligne, dans un dossier
# temporaire, pour ne remplacer que la partie de la cible.
$dist = (Resolve-Path "dist").Path
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("dualia-gh-pages-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
git clone --quiet --depth 1 --branch gh-pages --single-branch $depot $tmp
if ($LASTEXITCODE -ne 0) {
    Write-Host "Impossible de cloner la branche gh-pages. Deploiement annule." -ForegroundColor Red
    exit 1
}

if ($Cible -eq "prod") {
    # Tout remplacer a la racine, SAUF .git et le dossier preprod/.
    Get-ChildItem -LiteralPath $tmp -Force |
        Where-Object { $_.Name -ne ".git" -and $_.Name -ne "preprod" } |
        Remove-Item -Recurse -Force
    Copy-Item -Path (Join-Path $dist "*") -Destination $tmp -Recurse -Force
    # Ceinture et bretelles : selon le systeme, * peut ignorer les fichiers commencant par un point.
    Copy-Item -LiteralPath (Join-Path $dist ".nojekyll") -Destination $tmp -Force
} else {
    # Ne remplacer QUE le dossier preprod/ ; la racine (la prod) n'est pas touchee.
    $dossierPreprod = Join-Path $tmp "preprod"
    if (Test-Path -LiteralPath $dossierPreprod) {
        Remove-Item -LiteralPath $dossierPreprod -Recurse -Force
    }
    Copy-Item -LiteralPath $dist -Destination $dossierPreprod -Recurse -Force
}

Push-Location $tmp
try {
    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Rien n'a change sur gh-pages : rien a pousser." -ForegroundColor Yellow
    } else {
        git commit --quiet -m "Deploy Dualia web build ($Cible) $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
        if ($LASTEXITCODE -ne 0) { throw "Echec du commit sur gh-pages." }
        # Push SANS force : si gh-pages a bouge entre-temps, le push est refuse
        # plutot que d'ecraser l'autre environnement. Il suffit alors de relancer.
        git push origin gh-pages
        if ($LASTEXITCODE -ne 0) { throw "Push refuse sur gh-pages. Relance le script." }
    }
} finally {
    Pop-Location
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "`n=== DEPLOIEMENT TERMINE ($Cible) ===" -ForegroundColor Green
Write-Host "Attends 1-2 minutes puis teste sur :" -ForegroundColor Cyan
Write-Host $urlCible -ForegroundColor White
Write-Host "`nConseil : teste d'abord en navigation privee (Ctrl+Maj+N) pour eviter le cache." -ForegroundColor DarkGray
