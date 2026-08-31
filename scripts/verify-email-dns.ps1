# Vérifie SPF / DMARC / DKIM pour dragons@romerogates.be (OVH)
# Usage: .\scripts\verify-email-dns.ps1

$domain = 'romerogates.be'
$resolver = '8.8.8.8'

Write-Host "`n=== SPF ($domain) ===" -ForegroundColor Cyan
nslookup -type=TXT $domain $resolver 2>$null | Select-String 'spf1'

Write-Host "`n=== DMARC (_dmarc.$domain) ===" -ForegroundColor Cyan
nslookup -type=TXT "_dmarc.$domain" $resolver 2>$null | Select-String 'DMARC'

Write-Host "`n=== DKIM (sélecteurs OVH courants) ===" -ForegroundColor Cyan
foreach ($sel in @('ovhselector1', 'ovhselector2')) {
  Write-Host "  $sel._domainkey.$domain" -ForegroundColor DarkGray
  nslookup -type=CNAME "$sel._domainkey.$domain" $resolver 2>$null | Select-String 'domainkey|canonical'
}

Write-Host "`nSi DKIM ne résout pas : Manager OVH > Emails > DKIM > Activer et publier les CNAME." -ForegroundColor Yellow
Write-Host "Test complet : https://www.mail-tester.com/`n" -ForegroundColor Green
