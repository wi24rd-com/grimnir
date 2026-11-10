//! Ydelsesmåling (K6): 1, 10 og 100 MB opdigtet tekst. Ikke en test, der kan fejle.
//!
//! Kør: `cargo run --release -p grimnir-core --example ydelse`
//! Uret bruges kun her i eksemplet, aldrig i kernen.

use std::time::Instant;

use grimnir_core::{analyser, demasker, foreslaa, laekagetjek, masker, Ordbog, Sag};

/// Lille deterministisk talgenerator (fast frø).
struct Frø(u64);

impl Frø {
    fn tal(&mut self, n: u64) -> u64 {
        self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
        (self.0 >> 33) % n
    }
}

fn linje(r: &mut Frø) -> String {
    let ip = format!("10.{}.{}.{}", 20 + r.tal(8), r.tal(40), r.tal(250) + 2);
    let dst = format!("100.99.{}.{}", r.tal(250), r.tal(250) + 1);
    let mac = format!("0a:1b:2c:{:02x}:{:02x}:{:02x}", r.tal(256), r.tal(256), r.tal(256));
    match r.tal(5) {
        0 => format!(
            "date=2026-11-10 time=10:{:02}:{:02} devname=\"FW-KONTOR01\" srcip={ip} srcmac={mac} dstip={dst} dstport=443 user=\"bruger{:03}\" action=\"accept\"\n",
            r.tal(60),
            r.tal(60),
            r.tal(500)
        ),
        1 => format!("Nov 10 10:00:01 srv-{:03} sshd[123]: Accepted publickey for bruger{:03} from {ip} port 52314 ssh2\n", r.tal(999), r.tal(500)),
        2 => format!("-- Server=srv-{:03}.intern.kontor.test;Database=Kunde_DB;User Id=app;Password=Sommer{}!;\n", r.tal(999), r.tal(9999)),
        3 => format!("<Data Name=\"Konto\">KONTOR\\bruger{:03}</Data><Data Name=\"IpAddress\">{ip}</Data>\n", r.tal(500)),
        _ => "almindelig tekst uden noget følsomt, version 10.2.3.4 og README.md\n".to_string(),
    }
}

fn main() {
    let mut ordbog = Ordbog::ny();
    ordbog.domaener = vec!["kontor.test".into(), "KONTOR".into()];
    ordbog.navnemoenstre = vec!["srv-###".into()];
    for mb in [1usize, 10, 100] {
        let mut r = Frø(20261110);
        let mut tekst = String::with_capacity(mb << 20);
        while tekst.len() < mb << 20 {
            tekst.push_str(&linje(&mut r));
        }
        let mut sag = Sag::default();
        let t0 = Instant::now();
        let fund = analyser(&tekst, &ordbog);
        let t1 = Instant::now();
        let e = foreslaa(&fund, &tekst, &mut sag);
        let t2 = Instant::now();
        let m = masker(&tekst, &e);
        let t3 = Instant::now();
        let rester = laekagetjek(&m, &sag, &ordbog);
        let t4 = Instant::now();
        let (tilbage, adv) = demasker(&m, &sag);
        let t5 = Instant::now();
        // Samme tekst igen med den fyldte sag: F1-søgningen efter sagens kendte originaler (V-KERNE.2)
        let e2 = foreslaa(&fund, &tekst, &mut sag);
        let t6 = Instant::now();
        let samme = masker(&tekst, &e2) == m;
        let ms = |a: Instant, b: Instant| (b - a).as_secs_f64() * 1000.0;
        println!(
            "{:>4} MB | fund {:>8} | poster {:>7} | analyser {:>8.1} ms | foreslaa {:>8.1} ms | masker {:>7.1} ms | laekagetjek {:>8.1} ms (rest {}) | demasker {:>8.1} ms (advarsler {}) | rundtur bytepraecis: {} | foreslaa igen {:>8.1} ms (samme resultat: {})",
            mb,
            fund.len(),
            sag.antal_poster(),
            ms(t0, t1),
            ms(t1, t2),
            ms(t2, t3),
            ms(t3, t4),
            rester.len(),
            ms(t4, t5),
            adv.len(),
            tilbage == tekst,
            ms(t5, t6),
            samme
        );
    }
}
