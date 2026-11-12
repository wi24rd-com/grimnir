# Opdigtet script til afproevning af Grimnir. Alle navne og adresser er opfundne.
$Server   = "srv-db02.intern.eksempel-firma.example"
$Database = "SagsDB_Test"
$Bruger   = "EKSEMPEL\svc-backup"
$Kode     = "Vinter2026!Opdigtet"
$ApiNoegle = "sk_test_9c8b7a6d5e4f3a2b1c0d9e8f7a6b5c4d"
$Maal     = "\\nas-arkiv\backup\sagsdb"

$Forbindelse = "Server=$Server;Database=$Database;User Id=$Bruger;Password=$Kode;"
Invoke-Sqlcmd -ConnectionString $Forbindelse -Query "BACKUP DATABASE [$Database] TO DISK = '$Maal\sagsdb.bak'"

foreach ($pc in @("pc-17", "pc-204", "dc01")) {
    Test-Connection -ComputerName "$pc.intern.eksempel-firma.example" -Count 1
}
Send-MailMessage -To "anna.testesen@eksempel-firma.example" -From "drift@eksempel-firma.example" -SmtpServer "mail01.intern.eksempel-firma.example" -Subject "Backup faerdig"
Invoke-RestMethod -Uri "https://portal.eksempel-firma.example/api/v1/status" -Headers @{ Authorization = "Bearer $ApiNoegle" }
