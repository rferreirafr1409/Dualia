# maj-i18n-documents.ps1
#
# Remplace les quatre blocs `documents:` de constants/i18n.ts (fr, es, pt, en)
# par les versions refondues, sans toucher au reste du fichier.
#
# A lancer depuis la racine du projet :
#   .\maj-i18n-documents.ps1
#
# Ce script ne contient AUCUN caractere accentue : les blocs sont encodes en
# base64 et decodes en UTF-8 a l'execution. L'encodage du present fichier n'a
# donc aucune influence sur le resultat, ce qui evite la corruption des accents
# observee avec les versions precedentes.
#
# Securites :
#   - sauvegarde horodatee avant toute ecriture
#   - si le nombre de blocs trouves n'est pas exactement 4, rien n'est modifie
#   - controle des accents sur les blocs decodes avant ecriture

$ErrorActionPreference = 'Stop'
$chemin = Join-Path $PSScriptRoot 'constants\i18n.ts'

if (-not (Test-Path $chemin)) {
  Write-Host "Fichier introuvable : $chemin" -ForegroundColor Red
  Write-Host "Lance ce script depuis la racine du projet (dualia-mvp)." -ForegroundColor Yellow
  exit 1
}

$encodage = New-Object System.Text.UTF8Encoding($false)
$texte = [System.IO.File]::ReadAllText($chemin, $encodage)

# Un bloc documents commence par "    documents: {" (4 espaces) et se termine
# par la premiere ligne "    }," a la meme indentation. Le \r? tolere les fins
# de ligne Windows.
$motif = [regex]"(?sm)^    documents: \{.*?^    \},\r?$"
$trouves = $motif.Matches($texte)

Write-Host "Blocs documents trouves : $($trouves.Count)" -ForegroundColor Cyan

if ($trouves.Count -ne 4) {
  Write-Host "Attendu : 4 blocs (fr, es, pt, en). Aucune modification effectuee." -ForegroundColor Red
  exit 1
}

# --- Blocs encodes en base64 (UTF-8), dans l'ordre du fichier ---------------

function ConvertFrom-Base64Utf8($b64) {
  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
}

$b64fr =
  'ICAgIGRvY3VtZW50czogewogICAgICB0aXRyZTogJ0RvY3VtZW50cycsCiAgICAgIHNvdXNUaXRyZTogJ1ZvdHJlIGNvZmZyZS1m' +
  'b3J0IGZhbWlsaWFsJywKICAgICAgZG9jczogJ2RvY3MnLAogICAgICBjb21wdGV1cjogKG46IG51bWJlcikgPT4gYCR7bn0gZG9j' +
  'dW1lbnQke24gPiAxID8gJ3MnIDogJyd9YCwKICAgICAgcmVjaGVyY2hlclBsYWNlaG9sZGVyOiAnUmVjaGVyY2hlciB1biBkb2N1' +
  'bWVudC4uLicsCiAgICAgIHRvdXM6ICdUb3VzJywKICAgICAgdG91dGVzOiAnVG91dGVzJywKICAgICAgY29uY2VybmU6ICdDb25j' +
  'ZXJuZScsCiAgICAgIGNvbmNlcm5lQWlkZTogIkNob2lzaXNzZXogdW4gb3UgcGx1c2lldXJzIGVuZmFudHMsIG91IEZhbWlsbGUg' +
  'cG91ciB1biBkb2N1bWVudCBxdWkgY29uY2VybmUgbCdvcmdhbmlzYXRpb24gZmFtaWxpYWxlLiIsCiAgICAgIGZhbWlsbGU6ICdG' +
  'YW1pbGxlJywKICAgICAgY2F0ZWdvcmllczogewogICAgICAgIGFkbWluaXN0cmF0aWY6ICdBZG1pbmlzdHJhdGlmJywKICAgICAg' +
  'ICBzYW50ZTogJ1NhbnTDqScsCiAgICAgICAgZWNvbGU6ICfDiWNvbGUnLAogICAgICAgIGp1cmlkaXF1ZTogJ0p1cmlkaXF1ZScs' +
  'CiAgICAgIH0sCiAgICAgIGNlcnRpZmllOiAnQ2VydGlmacOpJywKICAgICAgc3RhbmRhcmQ6ICdTdGFuZGFyZCcsCiAgICAgIGF1' +
  'Y3VuRG9jdW1lbnQ6ICdBdWN1biBkb2N1bWVudCcsCiAgICAgIGF1Y3VuRmljaGllcjogJ1NhbnMgZmljaGllcicsCiAgICAgIGFq' +
  'b3V0ZVBhcjogKG5vbTogc3RyaW5nKSA9PiBgQWpvdXTDqSBwYXIgJHtub219YCwKICAgICAgYWpvdXRlckRvY3VtZW50OiAnQWpv' +
  'dXRlciB1biBkb2N1bWVudCcsCiAgICAgIGNhZHJlRmFtaWxpYWxUaXRyZTogJ0NhZHJlIGZhbWlsaWFsJywKICAgICAgY2FkcmVG' +
  'YW1pbGlhbFRleHRlOiAiSW1wb3J0ZXogdW4ganVnZW1lbnQsIHVuZSBjb252ZW50aW9uIG91IHVuIGFjY29yZCBwYXJlbnRhbCBw' +
  'b3VyIHF1ZSBEdWFsaWEgaWRlbnRpZmllIGxlcyByw6hnbGVzIGRlIHZvdHJlIG9yZ2FuaXNhdGlvbi4iLAogICAgICBjYWRyZUZh' +
  'bWlsaWFsQ3RhOiAnSW1wb3J0ZXIgdW4gZG9jdW1lbnQnLAogICAgICBvdXZyaXI6ICdPdXZyaXInLAogICAgICBtb2RpZmllcjog' +
  'J01vZGlmaWVyJywKICAgICAgc3VwcHJpbWVyOiAnU3VwcHJpbWVyJywKICAgICAgY29uZmlybWVyU3VwcHJlc3Npb246IChub206' +
  'IHN0cmluZykgPT4gYFN1cHByaW1lciDCqyAke25vbX0gwrsgPyBDZXR0ZSBhY3Rpb24gZXN0IGTDqWZpbml0aXZlLmAsCiAgICAg' +
  'IG1vZGFsVGl0cmU6ICdOb3V2ZWF1IGRvY3VtZW50JywKICAgICAgbW9kYWxUaXRyZU1vZGlmaWVyOiAnTW9kaWZpZXIgbGUgZG9j' +
  'dW1lbnQnLAogICAgICBub21Eb2N1bWVudDogJ05vbSBkdSBkb2N1bWVudCcsCiAgICAgIG5vbVBsYWNlaG9sZGVyOiAnRXggOiBD' +
  'YXJuZXQgZGUgc2FudMOpJywKICAgICAgY2F0ZWdvcmllOiAnQ2F0w6lnb3JpZScsCiAgICAgIG5vdGU6ICdOb3RlIChmYWN1bHRh' +
  'dGlmKScsCiAgICAgIG5vdGVQbGFjZWhvbGRlcjogJ0Rlc2NyaXB0aW9uIG91IHJlbWFycXVlLi4uJywKICAgICAgYW5udWxlcjog' +
  'J0FubnVsZXInLAogICAgICBham91dGVyOiAnQWpvdXRlcicsCiAgICAgIGVucmVnaXN0cmVyOiAnRW5yZWdpc3RyZXInLAogICAg' +
  'fSw='

$b64es =
  'ICAgIGRvY3VtZW50czogewogICAgICB0aXRyZTogJ0RvY3VtZW50b3MnLAogICAgICBzb3VzVGl0cmU6ICdWdWVzdHJhIGNhamEg' +
  'ZnVlcnRlIGZhbWlsaWFyJywKICAgICAgZG9jczogJ2RvY3MnLAogICAgICBjb21wdGV1cjogKG46IG51bWJlcikgPT4gYCR7bn0g' +
  'ZG9jdW1lbnRvJHtuID4gMSA/ICdzJyA6ICcnfWAsCiAgICAgIHJlY2hlcmNoZXJQbGFjZWhvbGRlcjogJ0J1c2NhciB1biBkb2N1' +
  'bWVudG8uLi4nLAogICAgICB0b3VzOiAnVG9kb3MnLAogICAgICB0b3V0ZXM6ICdUb2RhcycsCiAgICAgIGNvbmNlcm5lOiAnQ29u' +
  'Y2llcm5lIGEnLAogICAgICBjb25jZXJuZUFpZGU6ICdFbGlnZSB1bm8gbyB2YXJpb3MgaGlqb3MsIG8gRmFtaWxpYSBwYXJhIHVu' +
  'IGRvY3VtZW50byBxdWUgY29uY2llcm5lIGEgbGEgb3JnYW5pemFjacOzbiBmYW1pbGlhci4nLAogICAgICBmYW1pbGxlOiAnRmFt' +
  'aWxpYScsCiAgICAgIGNhdGVnb3JpZXM6IHsKICAgICAgICBhZG1pbmlzdHJhdGlmOiAnQWRtaW5pc3RyYXRpdm8nLAogICAgICAg' +
  'IHNhbnRlOiAnU2FsdWQnLAogICAgICAgIGVjb2xlOiAnQ29sZWdpbycsCiAgICAgICAganVyaWRpcXVlOiAnSnVyw61kaWNvJywK' +
  'ICAgICAgfSwKICAgICAgY2VydGlmaWU6ICdDZXJ0aWZpY2FkbycsCiAgICAgIHN0YW5kYXJkOiAnRXN0w6FuZGFyJywKICAgICAg' +
  'YXVjdW5Eb2N1bWVudDogJ05pbmfDum4gZG9jdW1lbnRvJywKICAgICAgYXVjdW5GaWNoaWVyOiAnU2luIGFyY2hpdm8nLAogICAg' +
  'ICBham91dGVQYXI6IChub206IHN0cmluZykgPT4gYEHDsWFkaWRvIHBvciAke25vbX1gLAogICAgICBham91dGVyRG9jdW1lbnQ6' +
  'ICdBw7FhZGlyIHVuIGRvY3VtZW50bycsCiAgICAgIGNhZHJlRmFtaWxpYWxUaXRyZTogJ01hcmNvIGZhbWlsaWFyJywKICAgICAg' +
  'Y2FkcmVGYW1pbGlhbFRleHRlOiAnSW1wb3J0YSB1bmEgc2VudGVuY2lhLCB1biBjb252ZW5pbyByZWd1bGFkb3IgbyB1biBhY3Vl' +
  'cmRvIHBhcmVudGFsIHBhcmEgcXVlIER1YWxpYSBpZGVudGlmaXF1ZSBsYXMgcmVnbGFzIGRlIHZ1ZXN0cmEgb3JnYW5pemFjacOz' +
  'bi4nLAogICAgICBjYWRyZUZhbWlsaWFsQ3RhOiAnSW1wb3J0YXIgdW4gZG9jdW1lbnRvJywKICAgICAgb3V2cmlyOiAnQWJyaXIn' +
  'LAogICAgICBtb2RpZmllcjogJ01vZGlmaWNhcicsCiAgICAgIHN1cHByaW1lcjogJ0VsaW1pbmFyJywKICAgICAgY29uZmlybWVy' +
  'U3VwcHJlc3Npb246IChub206IHN0cmluZykgPT4gYMK/RWxpbWluYXIgwqske25vbX3Cuz8gRXN0YSBhY2Npw7NuIGVzIGRlZmlu' +
  'aXRpdmEuYCwKICAgICAgbW9kYWxUaXRyZTogJ051ZXZvIGRvY3VtZW50bycsCiAgICAgIG1vZGFsVGl0cmVNb2RpZmllcjogJ01v' +
  'ZGlmaWNhciBlbCBkb2N1bWVudG8nLAogICAgICBub21Eb2N1bWVudDogJ05vbWJyZSBkZWwgZG9jdW1lbnRvJywKICAgICAgbm9t' +
  'UGxhY2Vob2xkZXI6ICdFajogQ2FydGlsbGEgZGUgc2FsdWQnLAogICAgICBjYXRlZ29yaWU6ICdDYXRlZ29yw61hJywKICAgICAg' +
  'bm90ZTogJ05vdGEgKG9wY2lvbmFsKScsCiAgICAgIG5vdGVQbGFjZWhvbGRlcjogJ0Rlc2NyaXBjacOzbiBvIGNvbWVudGFyaW8u' +
  'Li4nLAogICAgICBhbm51bGVyOiAnQ2FuY2VsYXInLAogICAgICBham91dGVyOiAnQcOxYWRpcicsCiAgICAgIGVucmVnaXN0cmVy' +
  'OiAnR3VhcmRhcicsCiAgICB9LA=='

$b64pt =
  'ICAgIGRvY3VtZW50czogewogICAgICB0aXRyZTogJ0RvY3VtZW50b3MnLAogICAgICBzb3VzVGl0cmU6ICdPIHZvc3NvIGNvZnJl' +
  'IGZhbWlsaWFyJywKICAgICAgZG9jczogJ2RvY3MnLAogICAgICBjb21wdGV1cjogKG46IG51bWJlcikgPT4gYCR7bn0gZG9jdW1l' +
  'bnRvJHtuID4gMSA/ICdzJyA6ICcnfWAsCiAgICAgIHJlY2hlcmNoZXJQbGFjZWhvbGRlcjogJ1Blc3F1aXNhciB1bSBkb2N1bWVu' +
  'dG8uLi4nLAogICAgICB0b3VzOiAnVG9kb3MnLAogICAgICB0b3V0ZXM6ICdUb2RhcycsCiAgICAgIGNvbmNlcm5lOiAnRGl6IHJl' +
  'c3BlaXRvIGEnLAogICAgICBjb25jZXJuZUFpZGU6ICdFc2NvbGhlIHVtIG91IHbDoXJpb3MgZmlsaG9zLCBvdSBGYW3DrWxpYSBw' +
  'YXJhIHVtIGRvY3VtZW50byBxdWUgZGl6IHJlc3BlaXRvIMOgIG9yZ2FuaXphw6fDo28gZmFtaWxpYXIuJywKICAgICAgZmFtaWxs' +
  'ZTogJ0ZhbcOtbGlhJywKICAgICAgY2F0ZWdvcmllczogewogICAgICAgIGFkbWluaXN0cmF0aWY6ICdBZG1pbmlzdHJhdGl2bycs' +
  'CiAgICAgICAgc2FudGU6ICdTYcO6ZGUnLAogICAgICAgIGVjb2xlOiAnRXNjb2xhJywKICAgICAgICBqdXJpZGlxdWU6ICdKdXLD' +
  'rWRpY28nLAogICAgICB9LAogICAgICBjZXJ0aWZpZTogJ0NlcnRpZmljYWRvJywKICAgICAgc3RhbmRhcmQ6ICdQYWRyw6NvJywK' +
  'ICAgICAgYXVjdW5Eb2N1bWVudDogJ05lbmh1bSBkb2N1bWVudG8nLAogICAgICBhdWN1bkZpY2hpZXI6ICdTZW0gZmljaGVpcm8n' +
  'LAogICAgICBham91dGVQYXI6IChub206IHN0cmluZykgPT4gYEFkaWNpb25hZG8gcG9yICR7bm9tfWAsCiAgICAgIGFqb3V0ZXJE' +
  'b2N1bWVudDogJ0FkaWNpb25hciB1bSBkb2N1bWVudG8nLAogICAgICBjYWRyZUZhbWlsaWFsVGl0cmU6ICdFbnF1YWRyYW1lbnRv' +
  'IGZhbWlsaWFyJywKICAgICAgY2FkcmVGYW1pbGlhbFRleHRlOiAnSW1wb3J0ZSB1bWEgc2VudGVuw6dhLCB1bWEgY29udmVuw6fD' +
  'o28gb3UgdW0gYWNvcmRvIHBhcmVudGFsIHBhcmEgcXVlIGEgRHVhbGlhIGlkZW50aWZpcXVlIGFzIHJlZ3JhcyBkYSB2b3NzYSBv' +
  'cmdhbml6YcOnw6NvLicsCiAgICAgIGNhZHJlRmFtaWxpYWxDdGE6ICdJbXBvcnRhciB1bSBkb2N1bWVudG8nLAogICAgICBvdXZy' +
  'aXI6ICdBYnJpcicsCiAgICAgIG1vZGlmaWVyOiAnTW9kaWZpY2FyJywKICAgICAgc3VwcHJpbWVyOiAnRWxpbWluYXInLAogICAg' +
  'ICBjb25maXJtZXJTdXBwcmVzc2lvbjogKG5vbTogc3RyaW5nKSA9PiBgRWxpbWluYXIgwqske25vbX3Cuz8gRXN0YSBhw6fDo28g' +
  'w6kgZGVmaW5pdGl2YS5gLAogICAgICBtb2RhbFRpdHJlOiAnTm92byBkb2N1bWVudG8nLAogICAgICBtb2RhbFRpdHJlTW9kaWZp' +
  'ZXI6ICdNb2RpZmljYXIgbyBkb2N1bWVudG8nLAogICAgICBub21Eb2N1bWVudDogJ05vbWUgZG8gZG9jdW1lbnRvJywKICAgICAg' +
  'bm9tUGxhY2Vob2xkZXI6ICdFeDogQm9sZXRpbSBkZSBzYcO6ZGUnLAogICAgICBjYXRlZ29yaWU6ICdDYXRlZ29yaWEnLAogICAg' +
  'ICBub3RlOiAnTm90YSAob3BjaW9uYWwpJywKICAgICAgbm90ZVBsYWNlaG9sZGVyOiAnRGVzY3Jpw6fDo28gb3UgY29tZW50w6Fy' +
  'aW8uLi4nLAogICAgICBhbm51bGVyOiAnQ2FuY2VsYXInLAogICAgICBham91dGVyOiAnQWRpY2lvbmFyJywKICAgICAgZW5yZWdp' +
  'c3RyZXI6ICdHdWFyZGFyJywKICAgIH0s'

$b64en =
  'ICAgIGRvY3VtZW50czogewogICAgICB0aXRyZTogJ0RvY3VtZW50cycsCiAgICAgIHNvdXNUaXRyZTogJ1lvdXIgZmFtaWx5IHZh' +
  'dWx0JywKICAgICAgZG9jczogJ2RvY3MnLAogICAgICBjb21wdGV1cjogKG46IG51bWJlcikgPT4gYCR7bn0gZG9jdW1lbnQke24g' +
  'PiAxID8gJ3MnIDogJyd9YCwKICAgICAgcmVjaGVyY2hlclBsYWNlaG9sZGVyOiAnU2VhcmNoIGEgZG9jdW1lbnQuLi4nLAogICAg' +
  'ICB0b3VzOiAnQWxsJywKICAgICAgdG91dGVzOiAnQWxsJywKICAgICAgY29uY2VybmU6ICdDb25jZXJucycsCiAgICAgIGNvbmNl' +
  'cm5lQWlkZTogJ0Nob29zZSBvbmUgb3IgbW9yZSBjaGlsZHJlbiwgb3IgRmFtaWx5IGZvciBhIGRvY3VtZW50IHRoYXQgY29uY2Vy' +
  'bnMgdGhlIGhvdXNlaG9sZCBhcyBhIHdob2xlLicsCiAgICAgIGZhbWlsbGU6ICdGYW1pbHknLAogICAgICBjYXRlZ29yaWVzOiB7' +
  'CiAgICAgICAgYWRtaW5pc3RyYXRpZjogJ0FkbWluaXN0cmF0aXZlJywKICAgICAgICBzYW50ZTogJ0hlYWx0aCcsCiAgICAgICAg' +
  'ZWNvbGU6ICdTY2hvb2wnLAogICAgICAgIGp1cmlkaXF1ZTogJ0xlZ2FsJywKICAgICAgfSwKICAgICAgY2VydGlmaWU6ICdDZXJ0' +
  'aWZpZWQnLAogICAgICBzdGFuZGFyZDogJ1N0YW5kYXJkJywKICAgICAgYXVjdW5Eb2N1bWVudDogJ05vIGRvY3VtZW50cycsCiAg' +
  'ICAgIGF1Y3VuRmljaGllcjogJ05vIGZpbGUnLAogICAgICBham91dGVQYXI6IChub206IHN0cmluZykgPT4gYEFkZGVkIGJ5ICR7' +
  'bm9tfWAsCiAgICAgIGFqb3V0ZXJEb2N1bWVudDogJ0FkZCBhIGRvY3VtZW50JywKICAgICAgY2FkcmVGYW1pbGlhbFRpdHJlOiAn' +
  'RmFtaWx5IGZyYW1ld29yaycsCiAgICAgIGNhZHJlRmFtaWxpYWxUZXh0ZTogJ0ltcG9ydCBhIGNvdXJ0IG9yZGVyLCBhIGNvbnNl' +
  'bnQgb3JkZXIgb3IgYSBwYXJlbnRpbmcgYWdyZWVtZW50IHNvIER1YWxpYSBjYW4gaWRlbnRpZnkgdGhlIHJ1bGVzIG9mIHlvdXIg' +
  'YXJyYW5nZW1lbnQuJywKICAgICAgY2FkcmVGYW1pbGlhbEN0YTogJ0ltcG9ydCBhIGRvY3VtZW50JywKICAgICAgb3V2cmlyOiAn' +
  'T3BlbicsCiAgICAgIG1vZGlmaWVyOiAnRWRpdCcsCiAgICAgIHN1cHByaW1lcjogJ0RlbGV0ZScsCiAgICAgIGNvbmZpcm1lclN1' +
  'cHByZXNzaW9uOiAobm9tOiBzdHJpbmcpID0+IGBEZWxldGUgIiR7bm9tfSI/IFRoaXMgY2Fubm90IGJlIHVuZG9uZS5gLAogICAg' +
  'ICBtb2RhbFRpdHJlOiAnTmV3IGRvY3VtZW50JywKICAgICAgbW9kYWxUaXRyZU1vZGlmaWVyOiAnRWRpdCBkb2N1bWVudCcsCiAg' +
  'ICAgIG5vbURvY3VtZW50OiAnRG9jdW1lbnQgbmFtZScsCiAgICAgIG5vbVBsYWNlaG9sZGVyOiAnRS5nLjogSGVhbHRoIHJlY29y' +
  'ZCcsCiAgICAgIGNhdGVnb3JpZTogJ0NhdGVnb3J5JywKICAgICAgbm90ZTogJ05vdGUgKG9wdGlvbmFsKScsCiAgICAgIG5vdGVQ' +
  'bGFjZWhvbGRlcjogJ0Rlc2NyaXB0aW9uIG9yIG5vdGUuLi4nLAogICAgICBhbm51bGVyOiAnQ2FuY2VsJywKICAgICAgYWpvdXRl' +
  'cjogJ0FkZCcsCiAgICAgIGVucmVnaXN0cmVyOiAnU2F2ZScsCiAgICB9LA=='

$nouveaux = @(
  (ConvertFrom-Base64Utf8 $b64fr),
  (ConvertFrom-Base64Utf8 $b64es),
  (ConvertFrom-Base64Utf8 $b64pt),
  (ConvertFrom-Base64Utf8 $b64en)
)
$langues = @('fr', 'es', 'pt', 'en')

# Controle des accents sur les blocs decodes : si la sequence typique d'une
# mauvaise lecture apparait, on s'arrete avant d'ecrire quoi que ce soit.
$sequenceCorrompue = [char]0x00C3
foreach ($bloc in $nouveaux) {
  if ($bloc.Contains($sequenceCorrompue)) {
    Write-Host "Decodage base64 incorrect. Rien n'a ete ecrit." -ForegroundColor Red
    exit 1
  }
}

# Controle positif : les accents attendus sont bien la.
if (-not $nouveaux[0].Contains([char]0x00E9)) {
  Write-Host "Accents absents des blocs decodes. Rien n'a ete ecrit." -ForegroundColor Red
  exit 1
}

# Le fichier utilise des fins de ligne Windows (CRLF) : on aligne les blocs
# inseres dessus, sinon le fichier se retrouve avec un melange des deux.
if ($texte.Contains("`r`n")) {
  for ($i = 0; $i -lt 4; $i++) {
    $nouveaux[$i] = $nouveaux[$i].Replace("`r`n", "`n").Replace("`n", "`r`n")
  }
}

# Sauvegarde avant modification
$sauvegarde = "$chemin.$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item $chemin $sauvegarde
Write-Host "Sauvegarde : $sauvegarde" -ForegroundColor DarkGray

# Remplacement du dernier vers le premier, pour que les positions des blocs
# precedents restent valides.
for ($i = 3; $i -ge 0; $i--) {
  $m = $trouves[$i]
  $texte = $texte.Remove($m.Index, $m.Length).Insert($m.Index, $nouveaux[$i].TrimEnd("`r", "`n"))
  Write-Host "Bloc $($langues[$i]) remplace" -ForegroundColor Green
}

[System.IO.File]::WriteAllText($chemin, $texte, $encodage)

Write-Host ""
Write-Host "=== i18n.ts mis a jour ===" -ForegroundColor Green
Write-Host "Verifie que VS Code affiche 0 probleme, puis lance .\deploy-dualia.ps1" -ForegroundColor Cyan
Write-Host "En cas de souci : restaure la sauvegarde ci-dessus." -ForegroundColor DarkGray
