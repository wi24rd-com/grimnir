//! Generator for det opdigtede korpus i `tests/korpus/` (fast frø 20261110).
//!
//! Alt er opfundet: RFC 1918-net 10.20.x, 172.16.5, 192.168.77, ordbogens net 100.70.0.0/16,
//! fremmede adresser i 100.99.0.0/16 (RFC 6598, ikke på internettet), ULA fd00::/8, lokalt
//! administrerede MAC-adresser (0a:…), `eksempel.dk`, opdigtede navne og hemmeligheder.

use std::collections::BTreeSet;

use super::Frø;

/// Korpusfilerne med indhold og facit.
pub struct Korpus {
    pub filer: Vec<(&'static str, String)>,
    /// Værdier, der skal maskeres (og aldrig stå i det maskerede resultat).
    pub fund: BTreeSet<String>,
    /// Tekst, der ikke må findes.
    pub ikke_fund: Vec<&'static str>,
    /// Fremmede adresser: findes, men maskeres ikke som standard (ADR D4).
    pub fremmede: BTreeSet<String>,
}

pub const IKKE_FUND: [&str; 6] = [
    "README.md",
    "System.Net.Sockets",
    "version 10.2.3.4",
    "1.3.6.1.4.1.9.9.42",
    "C:\\Temp",
    "deploy.sh",
];

struct G {
    r: Frø,
    fund: BTreeSet<String>,
    fremmede: BTreeSet<String>,
}

impl G {
    fn n(&mut self, n: u64) -> u64 {
        self.r.tal(n)
    }
    fn husk(&mut self, v: String) -> String {
        self.fund.insert(v.clone());
        v
    }
    fn vaert(&mut self) -> String {
        let n = self.n(99) + 1;
        self.husk(format!("srv-{n:03}"))
    }
    fn bruger(&mut self) -> String {
        let n = self.n(99) + 1;
        self.husk(format!("bruger{n:03}"))
    }
    fn ip(&mut self) -> String {
        let net = *self.r.vaelg(&["10.20.30", "10.20.31", "172.16.5", "192.168.77", "100.70.1"]);
        let v = self.n(250) + 2;
        self.husk(format!("{net}.{v}"))
    }
    fn fremmed(&mut self) -> String {
        let v = format!("100.99.{}.{}", self.n(250) + 1, self.n(250) + 1);
        self.fremmede.insert(v.clone());
        v
    }
    fn mac(&mut self) -> String {
        let v = format!("0a:1b:2c:{:02x}:{:02x}:{:02x}", self.n(256), self.n(256), self.n(256));
        self.husk(v)
    }
    fn ipv6(&mut self) -> String {
        let v = format!("fd00:20:30:{:x}::{:x}", self.n(8) + 1, self.n(4000) + 1);
        self.husk(v)
    }
    fn hemmelighed(&mut self) -> String {
        let ord = *self.r.vaelg(&["Sommer", "Vinter", "Uglebo", "Fjord", "Lyng", "Hav"]);
        let v = format!("{ord}{}!{}", self.n(9000) + 1000, *self.r.vaelg(&["xq", "zv", "kp", "wy"]));
        self.husk(v)
    }
    fn serie(&mut self) -> String {
        let v = format!("FGT60F{:07}", self.n(9_000_000) + 1_000_000);
        self.husk(v)
    }
    fn guid(&mut self) -> String {
        let h = |g: &mut G, n: usize| (0..n).map(|_| format!("{:x}", g.n(16))).collect::<String>();
        let v = format!("{}-{}-4{}-a{}-{}", h(self, 8), h(self, 4), h(self, 3), h(self, 3), h(self, 12));
        self.husk(v)
    }
    fn tid(&mut self) -> String {
        format!("{:02}:{:02}:{:02}", self.n(24), self.n(60), self.n(60))
    }
}

pub fn korpus() -> Korpus {
    let mut g = G {
        r: Frø::ny(20261110),
        fund: BTreeSet::new(),
        fremmede: BTreeSet::new(),
    };
    for v in [
        "eksempel.dk",
        "intern.eksempel.dk",
        "KONTOR",
        "FW-KONTOR01",
        "Kunde_DB",
        "Anna Testesen",
        "Projekt Uglebo",
    ] {
        g.fund.insert(v.to_string());
    }
    let mut filer = Vec::new();

    // Firewall-konfiguration i nøgle=værdi-stil
    let mut s =
        String::from("config system global\n    set hostname \"FW-KONTOR01\"\n    set admin-sport 443\nend\nconfig system interface\n");
    for i in 1..=6 {
        let (ip, kom) = (g.ip(), *g.r.vaelg(&["kantine", "lager", "Projekt Uglebo"]));
        s += &format!("    edit \"port{i}\"\n        set ip {ip} 255.255.255.0\n        set description \"{kom}\"\n    next\n");
    }
    s += "end\nconfig user local\n";
    for _ in 0..4 {
        let (b, h) = (g.bruger(), g.hemmelighed());
        s += &format!("    edit \"{b}\"\n        set passwd ENC {h}\n        set email-to \"{b}@eksempel.dk\"\n    next\n");
    }
    s += "end\nconfig vpn ipsec phase1-interface\n";
    for i in 1..=3 {
        let (f, h) = (g.fremmed(), g.hemmelighed());
        s += &format!("    edit \"vpn-{i}\"\n        set remote-gw {f}\n        set psksecret ENC {h}\n    next\n");
    }
    s += "end\n# firmware version 10.2.3.4, se README.md\n";
    filer.push(("firewall.conf", s));

    // Firewall-log i nøgle=værdi-stil
    let mut s = String::new();
    let serie = g.serie();
    for i in 0..40 {
        let (t, ip, mac, b) = (g.tid(), g.ip(), g.mac(), g.bruger());
        let dst = if i % 3 == 0 { g.fremmed() } else { g.ip() };
        s += &format!(
            "date=2026-11-10 time={t} devname=\"FW-KONTOR01\" devid=\"{serie}\" logid=\"00000000{i:02}\" type=\"traffic\" srcip={ip} srcmac={mac} dstip={dst} dstport=443 user=\"{b}\" action=\"accept\"\n"
        );
    }
    filer.push(("firewall.log", s));

    // PowerShell
    let mut s = String::from("# Opdigtet vedligeholdelsesscript. Kræver System.Net.Sockets og deploy.sh\n");
    for _ in 0..8 {
        let (v, b, h) = (g.vaert(), g.bruger(), g.hemmelighed());
        s += &format!("$kode = ConvertTo-SecureString \"{h}\" -AsPlainText -Force\n");
        s += &format!("$cred = New-Object PSCredential(\"KONTOR\\{b}\", $kode)\n");
        s += &format!("Get-Service -ComputerName {v} -Credential $cred\n");
        s += &format!("Copy-Item \\\\{v}\\deling\\rapport.csv C:\\Temp\\\n");
        s += &format!("Invoke-Command -ComputerName {v}.intern.eksempel.dk -ScriptBlock {{ Get-ChildItem C:\\Users\\{b}\\Documents }}\n");
    }
    filer.push(("script.ps1", s));

    // SQL med connection strings
    let mut s = String::from("-- Opdigtet databasescript\nUSE [Kunde_DB];\n");
    for _ in 0..6 {
        let (v, b, h) = (g.vaert(), g.bruger(), g.hemmelighed());
        s += &format!("-- Server={v}.intern.eksempel.dk;Database=Kunde_DB;User Id={b};Password={h};\n");
        s += &format!("CREATE LOGIN [KONTOR\\{b}] FROM WINDOWS;\n");
    }
    filer.push(("database.sql", s));

    // Syslog
    let mut s = String::new();
    for i in 0..30 {
        let (t, v) = (g.tid(), g.vaert());
        s += &match i % 4 {
            0 => {
                let (b, ip) = (g.bruger(), g.ip());
                format!(
                    "Nov 10 {t} {v} sshd[{}]: Accepted publickey for {b} from {ip} port 52314 ssh2\n",
                    1000 + i
                )
            }
            1 => {
                let b = g.bruger();
                format!("Nov 10 {t} {v} sudo: {b} : TTY=pts/0 ; PWD=/home/{b} ; COMMAND=/bin/cat README.md\n")
            }
            2 => {
                let (ip, mac) = (g.ip(), g.mac());
                format!("Nov 10 {t} {v} dhcpd: DHCPACK on {ip} to {mac} via eth0\n")
            }
            _ => {
                let v6 = g.ipv6();
                format!("Nov 10 {t} {v} kernel: ipv6 addr {v6} on eth0, snmp OID 1.3.6.1.4.1.9.9.42\n")
            }
        };
    }
    filer.push(("syslog.log", s));

    // Windows-hændelser som XML
    let mut s = String::from("<Events>\n");
    for i in 0..12 {
        let (v, b, ip) = (g.vaert(), g.bruger(), g.ip());
        let sid = g.husk(format!("S-1-5-21-1111111111-2222222222-3333333333-{}", 1100 + i));
        s += &format!(
            "<Event><System><EventID>4624</EventID><Computer>{v}.intern.eksempel.dk</Computer><Security UserID=\"{sid}\"/></System><EventData><Data Name=\"TargetUserName\">{b}</Data><Data Name=\"Konto\">KONTOR\\{b}</Data><Data Name=\"IpAddress\">{ip}</Data></EventData></Event>\n"
        );
    }
    s += "</Events>\n";
    filer.push(("haendelser.xml", s));

    // JSON
    let mut s = String::from("[\n");
    for i in 0..8 {
        let (gu, h, b, v) = (g.guid(), g.hemmelighed(), g.bruger(), g.vaert());
        let komma = if i < 7 { "," } else { "" };
        s += &format!(
            "  {{\"tenant_id\": \"{gu}\", \"client_secret\": \"{h}\", \"owner\": \"{b}@eksempel.dk\", \"server\": \"{v}.intern.eksempel.dk\", \"sti\": \"C:\\\\Users\\\\{b}\\\\AppData\", \"konto\": \"KONTOR\\\\{b}\", \"ansvarlig\": \"Anna Testesen\"}}{komma}\n"
        );
    }
    s += "]\n";
    filer.push(("data.json", s));

    // Kontrollens tilfælde 8.1–8.4
    let s = String::from(concat!(
        "8.1 bench=198.18.0.11 peer=203.0.113.5 navn h0001 gw=10.20.30.1\n",
        "8.2 a=010.020.030.001 b=10.20.30.1 c=fd00:0:0:1::5 d=fd00:0:0:1:0:0:0:5 e=FD00:0:0:1::5\n",
        "8.3 hostname=srv-068 arkiv srv-068_backup.log\n",
        "8.4 \"KONTOR\\\\bruger022\" og bruger022@eksempel.dk\n",
    ));
    for v in [
        "010.020.030.001",
        "10.20.30.1",
        "fd00:0:0:1::5",
        "fd00:0:0:1:0:0:0:5",
        "FD00:0:0:1::5",
        "srv-068",
        "bruger022",
    ] {
        g.fund.insert(v.to_string());
    }
    filer.push(("kontrol-8.txt", s));

    // Kontrollens tilfælde 8.5: over 9.999 værter i én sag
    let s: String = (0..10_050).map(|i| format!("hostname=vaert-{i:05}\n")).collect();
    for i in [0, 9_998, 9_999, 10_049] {
        g.fund.insert(format!("vaert-{i:05}"));
    }
    filer.push(("mange-vaerter.log", s));

    Korpus {
        filer,
        fund: g.fund,
        ikke_fund: IKKE_FUND.to_vec(),
        fremmede: g.fremmede,
    }
}

/// Facitlisten som tekst (skrives til `tests/korpus/facit.txt`).
pub fn facit_tekst(k: &Korpus) -> String {
    let mut s = String::from("# Facit for det opdigtede korpus (genereret med fast frø 20261110)\n[fund]\n");
    for f in &k.fund {
        s += &format!("{f}\n");
    }
    s += "[ikke-fund]\n";
    for f in &k.ikke_fund {
        s += &format!("{f}\n");
    }
    s += "[fremmede, findes men maskeres ikke som standard]\n";
    for f in &k.fremmede {
        s += &format!("{f}\n");
    }
    s
}
