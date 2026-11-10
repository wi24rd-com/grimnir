# Opdigtet vedligeholdelsesscript. Kræver System.Net.Sockets og deploy.sh
$kode = ConvertTo-SecureString "Vinter1268!wy" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger051", $kode)
Get-Service -ComputerName srv-062 -Credential $cred
Copy-Item \\srv-062\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-062.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger051\Documents }
$kode = ConvertTo-SecureString "Lyng7257!wy" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger071", $kode)
Get-Service -ComputerName srv-016 -Credential $cred
Copy-Item \\srv-016\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-016.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger071\Documents }
$kode = ConvertTo-SecureString "Vinter8772!xq" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger092", $kode)
Get-Service -ComputerName srv-030 -Credential $cred
Copy-Item \\srv-030\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-030.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger092\Documents }
$kode = ConvertTo-SecureString "Sommer2899!wy" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger050", $kode)
Get-Service -ComputerName srv-053 -Credential $cred
Copy-Item \\srv-053\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-053.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger050\Documents }
$kode = ConvertTo-SecureString "Sommer1315!wy" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger066", $kode)
Get-Service -ComputerName srv-002 -Credential $cred
Copy-Item \\srv-002\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-002.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger066\Documents }
$kode = ConvertTo-SecureString "Lyng5277!kp" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger035", $kode)
Get-Service -ComputerName srv-068 -Credential $cred
Copy-Item \\srv-068\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-068.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger035\Documents }
$kode = ConvertTo-SecureString "Lyng1475!kp" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger034", $kode)
Get-Service -ComputerName srv-082 -Credential $cred
Copy-Item \\srv-082\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-082.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger034\Documents }
$kode = ConvertTo-SecureString "Fjord7830!kp" -AsPlainText -Force
$cred = New-Object PSCredential("KONTOR\bruger097", $kode)
Get-Service -ComputerName srv-086 -Credential $cred
Copy-Item \\srv-086\deling\rapport.csv C:\Temp\
Invoke-Command -ComputerName srv-086.intern.kontor.test -ScriptBlock { Get-ChildItem C:\Users\bruger097\Documents }
