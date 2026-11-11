//! Maskering i skallen (V-SKAL.2, M2): sagen i hukommelsen og de fire handlinger, som kommandoerne i `lib.rs` kalder.
//!
//! Alt her er rene funktioner over [`Tilstand`], så de kan testes uden vindue (`tests/m2_kommandoer.rs`). Sagen lever
//! kun i hukommelsen; intet skrives til disk, og intet her skriver til log eller konsol.
//!
//! **Rækker.** Tabellen i UI'et har én række pr. enhed (én maskine, én bruger, én adresse), ikke pr. forekomst. Rækkerne
//! findes ved et "fuldt" gennemløb på en kopi af sagen, hvor alt, kernen finder, får en kode (også `Tjek selv`,
//! `Version` og fremmede adresser). Rækkens id er byte-positionen for enhedens første forekomst; den ændrer sig ikke,
//! når brugeren slår rækker til og fra.
//!
//! **Koderne.** Derefter et gennemløb på en ny kopi med kun de valgte rækker, præcis som `gem_og_masker` gør det. Så
//! er de koder, tabellen viser, de koder, der bliver gemt. En fravalgt række holdes ude af kernens trin F1 (sagens
//! kendte originaler) ved at stå på en midlertidig "maskér aldrig"-liste, som også gives til lækagetjekket: brugeren
//! har valgt den fra, så den er ikke en rest.
//!
//! **Sagen ændres først ved [`gem_og_masker`]**, og kun hvis ingen rettelse blev afvist.
//!
//! **Sager på disk (V-SAG.1).** Programmet starter med en midlertidig sag i hukommelsen. [`sag_ny`] gør den til en
//! navngiven sag på disk ([`crate::sager`]); i en navngiven sag gemmer [`gem_og_masker`] sagen krypteret, før svaret
//! sendes. Fejler skrivningen, får brugeren fejlen og ingen maskeret tekst, så der aldrig findes en maskeret tekst,
//! som ingen sag kan demaskere.
//!
//! **Ordbogen (V-ORDBOG.1).** `analyser`, `gem_og_masker` og lækagetjekket bruger den aktuelle ordbog: kernens
//! `analyser` finder ordbogens værdier, og "maskér aldrig" gives videre til forslagene (F1) og lækagetjekket. Ordbogen
//! læses fra disk første gang, den bruges ([`crate::ordbog::Ordbogsfil`]). Kan den ikke åbnes, arbejder programmet
//! videre med en tom ordbog og afviser ændringer, så filen ikke overskrives.
//!
//! **Indstillinger (V-ORDBOG.1 O6).** En ny sag (ved start, Luk sag, Nulstil, Slet og en ny navngiven sag oven på en
//! navngiven) får valget fra indstillingerne ([`Tilstand::ny_sag`]). [`sag_valg`] ændrer valget for den åbne sag.
//!
//! **Låsen (V-LAAS.2).** Programmet starter låst ([`Tilstand::ved_start`]), når "Lås Grimnir ved start" er til. Mens det
//! er låst, svarer hver kommando, der bruger sager, ordbog, filer eller nøgler, med [`UiFejl::Laast`], før den rører noget
//! ([`Tilstand::aaben`]); også Maskér uden ordbog, fordi en maskering uden ordbog er en anden maskering. Nøglelageret
//! ligger desuden bag en vagt, der afviser hvert opslag, mens der er låst, så ingen nøgle kan læses ad en vej, porten ikke
//! dækker. Indstillinger, tema, sprog og Om virker. [`laas_op`] spørger døren ([`crate::laas::Doer`]) og låser op ved
//! `Ok`; ved `IkkeTilgaengelig` låses op uden bekræftelse, og [`LaasStatus::uden_doer`] siger hvorfor (banneret).
//! Døren beskytter mod en person ved en ulåst maskine, ikke mod et andet program, der kører som brugeren
//! ([`crate::laas`]).
//!
//! **Lås igen (V-LAAS.3).** Grimnir starter altid låst ([`Tilstand::ved_start`]; "Lås Grimnir ved start" er fjernet,
//! ADR D20). [`laas_igen`] låser igen ved dvale, skærmslukning, brugerskift og stilstand: den sætter låst først (så porten
//! lukker for nye kommandoer), gemmer en ændret navngiven sag, og slipper og nulstiller alle nøgler, den åbne sag,
//! ordbogen, de holdte filer og resultaterne. En midlertidig sag med poster gemmes (V-LAAS.4, se nedenfor); det siges
//! efter oplåsningen ([`EfterLaas`]). Kommandoer, der gemmer noget i tilstanden, tjekker låsen igen, efter de har taget
//! låsen til det, de gemmer i ([`Tilstand::sag_aaben`]); så kan en kommando, der kom forbi porten lige før
//! [`laas_igen`], ikke lægge indhold tilbage efter nulstillingen. Stilstand: [`tjek_stilstand`] med uret i
//! [`crate::stilstand`].
//!
//! **Ved lås mistes intet (V-LAAS.4, ADR D21).** En midlertidig sag med poster gemmes ved [`laas_igen`] som en navngiven
//! sag (`Midlertidig ÅÅÅÅ-MM-DD TT.MM.SS`, uret i [`crate::klokke`]); efter oplåsningen siges navnet ([`EfterLaas`]).
//! Udklipsholderen ryddes, hvis den stadig har den demaskerede tekst, Grimnir lagde der ([`udklip_kopieret`],
//! [`crate::udklip`]).
//!
//! **Ved afslutning mistes intet (V-LAAS.6).** Afslutter programmet, uden at brugeren har svaret på spørgsmålet om den
//! midlertidige sag (Afslut fra Dock, log ud, genstart, sluk), gemmes den som ved lås ([`ved_afslut`], med samme
//! funktion som [`laas_igen`]: [`gem_og_nulstil_sag`]). Navnet står i `<app-data>/gemt-ved-afslut.json`
//! ([`crate::indstillinger::GEMT_FILNAVN`]) og siges efter næste oplåsning, én gang.
//!
//! **Beskeden efter en lås overlever en afslutning (V-PUDS.1 N1).** Gemmer [`laas_igen`] en midlertidig sag, skrives
//! navnet i samme fil ([`husk_gemt_navn`]); afsluttes programmet fra låseskærmen, siges det efter oplåsningen ved næste
//! start. Oplåses der i samme kørsel, siges det dér, og filen slettes. Fejlbeskederne skrives ikke til disk.
//!
//! **Kvitteringen (V-KVIT.1).** Hver gennemført maskering efterlader tallene til en kvittering ([`crate::kvittering`]):
//! for indsat tekst i tilstanden, for en fil sammen med filens resultat. [`kvittering`] bygger teksten af dem. Tallene er
//! kun tal og typenøgler; de findes, så længe resultatet gør (en ny analyse, Nulstil, en anden sag og en lås fjerner dem).
//! Kvitteringen er ikke demaskeret tekst: den meldes ikke til [`udklip_kopieret`] og ryddes ikke fra udklipsholderen.

use std::collections::{HashMap, HashSet};
use std::hash::{BuildHasher, RandomState};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::ThreadId;

use grimnir_core::{
    analyser as kerne_analyser, demasker_med_steder as kerne_demasker, foreslaa_med_ordbog, laekagetjek, masker, Advarsel, AdvarselArt,
    AfledtArt, Art, Erstatning, Fejl, Fund, Klasse, Ordbog, Pulje, RestArt, Sag, Sikkerhed, Valg,
};
use serde::{Deserialize, Serialize};

use crate::fil::{self, Fil, FilFejl, Linjeskift, Tegnsaet};
use crate::igang::Igang;
use crate::indstillinger::{self, Indstillinger};
use crate::klokke::{self, Klokke, SystemKlokke};
use crate::kvittering::{self as kvit, Kilde, Tal, TypeTal};
use crate::laas::{begrundelse, Doer, Grund, Svar, Udloeser};
use crate::ordbog::{self as ob, FeltFejl, OrdbogPost, Ordbogsfil, PostType};
use crate::sager::{nulstil, opret_mappe, rens_navn, ryd_midlertidige, tjek_dato, AabenSag, Arkiv, Noegle, Noeglelager, SagFejl, SagsId};
use crate::stilstand::{Stilstand, Travl, Ur};
use crate::udklip::{Indhold, Udklip};

/// Største tekst, Maskér tager imod: 5 MiB (5 242 880 bytes). Større tekster kræver "Åbn fil" (B3b).
pub const MAKS_BYTES: usize = 5 * 1024 * 1024;
/// Største tekst, Demaskér tager imod: 8 MiB (8 388 608 bytes). Det maskerede kan blive større end originalen, fordi
/// koderne kan være længere end værdierne (fund 1 i V-SKAL.2).
pub const MAKS_DEMASKER: usize = 8 * 1024 * 1024;

/// Den sag, der er i brug: sagen i hukommelsen og, hvis den er navngiven, dens fil og nøgle. `nr` tælles op, hver gang
/// sagen erstattes (V-FIL.1: en maskeret fil i hukommelsen hører til den sag, der lavede den).
///
/// V-LAAS.3: `ugemt` er sand, når en navngiven sag i hukommelsen er ændret uden at være gemt; så gemmer [`laas_igen`] den
/// før nulstillingen. I dag sætter ingen kommando den: hver ændring af en navngiven sag gemmes, før den træder i kraft
/// ([`gem_og_masker`], [`sag_valg`], `ret_hoved`), og fejler gemningen, er sagen i hukommelsen uændret. Kun testkrogen
/// [`marker_ugemt`] sætter den.
#[derive(Default)]
struct Aktuel {
    sag: Sag,
    aaben: Option<AabenSag>,
    nr: u64,
    ugemt: bool,
}

/// Ordbogen i hukommelsen: posterne, skrivetælleren, de blev læst med, kernens ordbog og fejlen, hvis filen ikke kunne
/// åbnes (så er ordbogen tom, og ændringer afvises).
#[derive(Default)]
struct OrdbogTilstand {
    poster: Vec<OrdbogPost>,
    taeller: u64,
    kerne: Ordbog,
    fejl: Option<SagFejl>,
}

impl OrdbogTilstand {
    fn med(poster: Vec<OrdbogPost>, taeller: u64) -> Self {
        OrdbogTilstand {
            kerne: ob::kerne_ordbog(&poster),
            poster,
            taeller,
            fejl: None,
        }
    }

    /// Erstatter posterne (nulstiller de gamle og kernens gamle kopi).
    fn erstat(&mut self, poster: Vec<OrdbogPost>) {
        let kerne = ob::kerne_ordbog(&poster);
        ob::nulstil(std::mem::replace(&mut self.poster, poster));
        ob::nulstil_kerne(std::mem::replace(&mut self.kerne, kerne));
    }
}

/// V-LAAS.2: låsen. `laast` deles med vagten om nøglelageret ([`LaasVagt`]).
#[derive(Default)]
struct Laas {
    laast: Arc<AtomicBool>,
    /// Døren spørges højst én gang ad gangen (to tryk på "Lås op" giver ikke to dialoger).
    doer: Mutex<()>,
    /// Hvorfor Grimnir er låst op uden bekræftelse (`ingen_adgangskode` | `platform`); til banneret.
    uden_doer: Mutex<Option<&'static str>>,
    /// V-LAAS.3: hvorfor Grimnir er låst igen efter start (`None` ved start og efter oplåsning). Så længe den er sat,
    /// kalder UI'et ikke `laas_op` af sig selv efter genindlæsningen.
    igen: Mutex<Option<Udloeser>>,
    /// V-LAAS.3: det, brugeren skal have at vide efter næste oplåsning.
    efter: Mutex<EfterLaas>,
    /// V-LAAS.4: den tråd, der er midt i [`laas_igen`] og gemmer den midlertidige sag; kun den kommer forbi vagten om
    /// nøglelageret, mens der er låst. Deles med [`LaasVagt`].
    undtagelse: Arc<Mutex<Option<ThreadId>>>,
    /// V-LAAS.4: holdes under hele [`laas_igen`]; oplåsningen venter på den, så porten ikke åbner midt i en lås, og
    /// beskederne efter låsen er skrevet, før de gives ud.
    koerer: Mutex<()>,
}

/// V-LAAS.3: det, der skete ved [`laas_igen`], og som UI'et viser efter oplåsningen. Intet indhold fra sagerne: navnet,
/// Grimnir selv gav den midlertidige sag, og fejl uden sti eller værdier.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct EfterLaas {
    /// V-LAAS.4: den midlertidige sag blev gemt under dette navn (`Midlertidig ÅÅÅÅ-MM-DD TT.MM.SS`); den står i
    /// sagslisten og åbnes ikke af sig selv.
    pub midlertidig_gemt: Option<String>,
    /// V-LAAS.4: den midlertidige sag kunne ikke gemmes (nøglelager eller disk) og er lukket.
    pub midlertidig_fejl: Option<SagFejl>,
    /// Den åbne navngivne sag var ændret og kunne ikke gemmes, da Grimnir låste.
    pub gem_fejl: Option<SagFejl>,
}

impl EfterLaas {
    fn tom(&self) -> bool {
        self.midlertidig_gemt.is_none() && self.midlertidig_fejl.is_none() && self.gem_fejl.is_none()
    }
}

/// Nøglelageret bag låsen: mens Grimnir er låst, afvises hvert opslag ([`SagFejl::Noeglering`] `laast`), og det
/// rigtige lager (Nøglering) bliver ikke spurgt.
///
/// V-LAAS.4: undtagen fra den ene tråd, der står i [`laas_igen`] og gemmer den midlertidige sag ([`Undtagelse`]). Alle
/// andre tråde afvises fra det øjeblik, låst sættes.
struct LaasVagt {
    laast: Arc<AtomicBool>,
    undtagelse: Arc<Mutex<Option<ThreadId>>>,
    lager: Arc<dyn Noeglelager>,
}

impl LaasVagt {
    fn tjek(&self) -> Result<(), SagFejl> {
        if !self.laast.load(Ordering::SeqCst) {
            return Ok(());
        }
        if *self.undtagelse.lock().unwrap_or_else(|e| e.into_inner()) == Some(std::thread::current().id()) {
            return Ok(());
        }
        Err(SagFejl::Noeglering { hvad: "laast" })
    }
}

/// V-LAAS.4: vagten om nøglelageret lukker denne tråd igennem, så længe værdien lever (også ved panik: `Drop`).
struct Undtagelse<'a>(&'a Mutex<Option<ThreadId>>);

impl<'a> Undtagelse<'a> {
    fn ny(m: &'a Mutex<Option<ThreadId>>) -> Self {
        *m.lock().unwrap_or_else(|e| e.into_inner()) = Some(std::thread::current().id());
        Undtagelse(m)
    }
}

impl Drop for Undtagelse<'_> {
    fn drop(&mut self) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }
}

/// V-LAAS.4: fingeraftryk af et demaskeret resultat: længden og en SipHash med en tilfældig nøgle pr. programstart
/// (`RandomState`). Bruges kun til at se, om udklipsholderen har netop den tekst; teksten selv gemmes ikke.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Fingeraftryk(usize, u64);

/// V-LAAS.4: det, Rust ved om udklipsholderen. `demaskeret[0]` er seneste demaskering af indsat tekst, `[1]` af filen i
/// Demaskér. `taeller` er udklipsholderens tæller lige efter et Kopiér i Demaskér, der blev genkendt.
#[derive(Default)]
struct UdklipHusk {
    noegle: RandomState,
    demaskeret: [Option<Fingeraftryk>; 2],
    taeller: Option<isize>,
}

impl UdklipHusk {
    fn fingeraftryk(&self, tekst: &str) -> Fingeraftryk {
        Fingeraftryk(tekst.len(), self.noegle.hash_one(tekst.as_bytes()))
    }
}

impl Noeglelager for LaasVagt {
    fn hent_konto(&self, konto: &str) -> Result<Noegle, SagFejl> {
        self.tjek()?;
        self.lager.hent_konto(konto)
    }
    fn gem_konto(&self, konto: &str, noegle: &Noegle) -> Result<(), SagFejl> {
        self.tjek()?;
        self.lager.gem_konto(konto, noegle)
    }
    fn slet_konto(&self, konto: &str) -> Result<(), SagFejl> {
        self.tjek()?;
        self.lager.slet_konto(konto)
    }
}

/// Programmets tilstand: den aktuelle sag, arkivet med sagerne på disk, ordbogen, indstillingerne og låsen.
#[derive(Default)]
pub struct Tilstand {
    sag: Mutex<Aktuel>,
    arkiv: Option<Arkiv>,
    ordbogsfil: Option<Ordbogsfil>,
    ordbog: Mutex<Option<OrdbogTilstand>>,
    indst_fil: Option<PathBuf>,
    indst: Mutex<Indstillinger>,
    afslut: AtomicBool,
    /// V-FIL.1: den åbne fil i Maskér (0) og i Demaskér (1). Låsen til en fil tages altid før sagens.
    filer: [Mutex<Option<HoldtFil>>; 2],
    /// V-RET.1 R5: igangværende skrivninger i brugerens mapper (`<app-data>/igang.json`); kun på disk.
    igang: Option<Igang>,
    /// V-LAAS.2: låsen. En ny tilstand er ulåst; [`Tilstand::ved_start`] låser.
    laas: Laas,
    /// V-LAAS.3: stilstand, målt med et monotont ur ([`crate::stilstand`]).
    stilstand: Stilstand,
    /// V-LAAS.4: vægur til navnet på en midlertidig sag, der gemmes ved lås (`None`: [`SystemKlokke`]).
    klokke: Option<Box<dyn Klokke>>,
    /// V-LAAS.4: UI'ets sprog er engelsk (navnet `Temporary …` i stedet for `Midlertidig …`). Sættes af `laas_op` og
    /// `menu_sprog`.
    engelsk: AtomicBool,
    /// V-LAAS.4: udklipsholderen (`None`: ingen; intet ryddes). Kun `lib.rs` giver den rigtige; tests en i hukommelsen.
    udklip: Option<Box<dyn Udklip>>,
    /// V-LAAS.4: det, Rust ved om udklipsholderen.
    udklip_husk: Mutex<UdklipHusk>,
    /// V-LAAS.6 N2: `<app-data>/gemt-ved-afslut.json` med navnet på en midlertidig sag, der blev gemt, da programmet
    /// afsluttede ([`ved_afslut`]) eller (V-PUDS.1 N1) låste ([`laas_igen`]); `None` uden mappe (tests i hukommelsen).
    gemt_fil: Option<PathBuf>,
    /// V-KVIT.1: tallene til kvitteringen for seneste maskering af indsat tekst, og sagens nummer efter gemningen (en
    /// fils tal ligger i filens [`Resultat`]). Kun tal. Låsen tages aldrig, mens sagens holdes.
    kvit_tekst: Mutex<Option<(u64, Tal)>>,
}

impl Tilstand {
    /// En tom tilstand uden sager på disk (kun hukommelsen). Ordbogen lever kun i hukommelsen.
    pub fn ny() -> Self {
        Tilstand::default()
    }

    /// En tom tilstand med sager på disk. Ordbog og indstillinger lever kun i hukommelsen (V-SAG.1's tests).
    pub fn med_arkiv(arkiv: Arkiv) -> Self {
        Tilstand {
            arkiv: Some(arkiv),
            ..Tilstand::default()
        }
    }

    /// Programmet på disk: sagerne i `<mappe>/sager`, ordbogen i `<mappe>/ordbog.grimnir` og indstillingerne i
    /// `<mappe>/indstillinger.json`; nøglerne i `lager`. Efterladte midlertidige filer ældre end en time slettes, og den
    /// første midlertidige sag får valget fra indstillingerne. Ordbogen læses først, når den bruges.
    ///
    /// V-RET.1 R5: midlertidige filer i brugerens mapper, som en afbrudt skrivning efterlod (noteret i
    /// `<mappe>/igang.json`), slettes, og listen tømmes ([`Igang::ryd`]).
    pub fn paa_disk(mappe: PathBuf, lager: Arc<dyn Noeglelager>) -> Self {
        let nu = std::time::SystemTime::now();
        let igang = Igang::ny(&mappe);
        igang.ryd();
        ryd_midlertidige(&mappe, nu);
        ryd_midlertidige(&mappe.join("sager"), nu);
        let indst_fil = indstillinger::sti(&mappe);
        let indst = indstillinger::laes(&indst_fil);
        let laas = Laas::default();
        // V-LAAS.6 N2: en midlertidig sag, der blev gemt ved sidste afslutning eller (V-PUDS.1 N1) lås, siges efter
        // første oplåsning ([`efter_svar`] sletter filen, når beskeden er givet).
        let gemt_fil = indstillinger::gemt_sti(&mappe);
        laas.efter.lock().unwrap_or_else(|e| e.into_inner()).midlertidig_gemt = indstillinger::laes_gemt_navn(&gemt_fil);
        let lager: Arc<dyn Noeglelager> = Arc::new(LaasVagt {
            laast: laas.laast.clone(),
            undtagelse: laas.undtagelse.clone(),
            lager,
        });
        Tilstand {
            sag: Mutex::new(Aktuel {
                sag: Sag::ny(indst.valg()),
                aaben: None,
                nr: 0,
                ugemt: false,
            }),
            arkiv: Some(Arkiv::ny(mappe.join("sager"), Box::new(lager.clone()))),
            ordbogsfil: Some(Ordbogsfil::ny(mappe, Box::new(lager))),
            ordbog: Mutex::new(None),
            indst_fil: Some(indst_fil),
            indst: Mutex::new(indst),
            afslut: AtomicBool::new(false),
            filer: Default::default(),
            igang: Some(igang),
            laas,
            gemt_fil: Some(gemt_fil),
            ..Tilstand::default()
        }
    }

    /// V-LAAS.3: den samme tilstand med stilstand målt med uret `ur` (tests styrer tiden).
    pub fn med_ur(mut self, ur: Box<dyn Ur>) -> Self {
        self.stilstand = Stilstand::med(ur);
        self
    }

    /// V-LAAS.4: den samme tilstand med vægur `klokke` til navnet på en midlertidig sag (tests styrer tiden).
    pub fn med_klokke(mut self, klokke: Box<dyn Klokke>) -> Self {
        self.klokke = Some(klokke);
        self
    }

    /// V-LAAS.4: den samme tilstand med udklipsholderen `udklip` (`lib.rs`: platformens; tests: en i hukommelsen).
    pub fn med_udklip(mut self, udklip: Option<Box<dyn Udklip>>) -> Self {
        self.udklip = udklip;
        self
    }

    /// V-LAAS.4: UI'ets sprog (`da` | `en`); afgør navnet på en midlertidig sag, der gemmes ved lås.
    pub fn saet_sprog(&self, sprog: &str) {
        self.engelsk.store(sprog == "en", Ordering::SeqCst);
    }

    /// V-LAAS.4: vægurets tid ([`SystemKlokke`], hvis ingen er givet).
    fn klokke(&self) -> &dyn Klokke {
        self.klokke.as_deref().unwrap_or(&SystemKlokke)
    }

    fn kvit_tekst(&self) -> MutexGuard<'_, Option<(u64, Tal)>> {
        self.kvit_tekst.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn udklip_husk(&self) -> MutexGuard<'_, UdklipHusk> {
        self.udklip_husk.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// V-LAAS.3: der er aktivitet nu (en kommando fra webvisningen, tastatur eller mus i vinduet).
    pub fn aktivitet(&self) {
        self.stilstand.aktivitet();
    }

    /// V-LAAS.3: en kommando er i gang, til vagten slippes; imens låser stilstand ikke.
    pub fn travl(&self) -> Travl<'_> {
        self.stilstand.travl()
    }

    /// Tilstanden ved programmets start: altid låst (V-LAAS.3 N1, ADR D20). En maskine uden dør låses op af `laas_op`,
    /// der svarer `IkkeTilgaengelig` (banneret).
    pub fn ved_start(self) -> Self {
        self.laas();
        self
    }

    /// Låser Grimnir (ved start). At låse igen efter start er [`laas_igen`], der også nulstiller.
    pub fn laas(&self) {
        self.laas.laast.store(true, Ordering::SeqCst);
        *self.laas.uden_doer.lock().unwrap_or_else(|e| e.into_inner()) = None;
    }

    /// Sand, mens Grimnir er låst.
    pub fn er_laast(&self) -> bool {
        self.laas.laast.load(Ordering::SeqCst)
    }

    /// Porten: [`UiFejl::Laast`], mens Grimnir er låst. Første linje i hver kommando, der bruger sager, ordbog, filer
    /// eller nøgler (også før en filvalgsdialog åbnes).
    pub fn aaben(&self) -> Result<(), UiFejl> {
        if self.er_laast() {
            Err(UiFejl::Laast)
        } else {
            Ok(())
        }
    }

    fn laas_op_uden_doer(&self, hvorfor: Option<&'static str>) {
        *self.laas.uden_doer.lock().unwrap_or_else(|e| e.into_inner()) = hvorfor;
        self.laas.laast.store(false, Ordering::SeqCst);
    }

    /// Låsen til sagen. Sagen ændres kun ved at blive erstattet af en færdigregnet kopi, så en forgiftet lås (panik i
    /// en anden tråd) efterlader aldrig en halvt ændret sag; derfor bruges indholdet videre.
    fn sag(&self) -> MutexGuard<'_, Aktuel> {
        self.sag.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// V-LAAS.3: låsen til sagen for en kommando, der vil gemme noget i den: tjekker porten igen, efter låsen er taget.
    /// [`laas_igen`] sætter låst, før den tager sagens lås; derfor kan en kommando, der kom forbi porten lige før, ikke
    /// lægge en sag (eller en nøgle) tilbage efter nulstillingen.
    fn sag_aaben(&self) -> Result<MutexGuard<'_, Aktuel>, UiFejl> {
        let g = self.sag();
        self.aaben()?;
        Ok(g)
    }

    /// V-LAAS.6: låsen til sagen, hvis den kan fås inden `frist` (ved afslutning, [`ved_afslut`]); ellers `None`.
    fn sag_inden(&self, frist: std::time::Duration) -> Option<MutexGuard<'_, Aktuel>> {
        let slut = std::time::Instant::now() + frist;
        loop {
            match self.sag.try_lock() {
                Ok(g) => return Some(g),
                Err(std::sync::TryLockError::Poisoned(e)) => return Some(e.into_inner()),
                Err(std::sync::TryLockError::WouldBlock) if std::time::Instant::now() >= slut => return None,
                Err(std::sync::TryLockError::WouldBlock) => std::thread::sleep(std::time::Duration::from_millis(10)),
            }
        }
    }

    fn arkiv(&self) -> Result<&Arkiv, UiFejl> {
        self.arkiv.as_ref().ok_or(UiFejl::IngenArkiv)
    }

    /// Indstillingerne nu.
    pub fn indstillinger(&self) -> Indstillinger {
        *self.indst.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// En ny, tom sag med valget fra indstillingerne. Kaldes før sagens lås tages (låsene tages aldrig i omvendt orden).
    pub fn ny_sag(&self) -> Sag {
        Sag::ny(self.indstillinger().valg())
    }

    /// Ordbogen, læst fra disk første gang. Ordbogens lås holdes aldrig samtidig med sagens.
    fn ordbog(&self) -> MutexGuard<'_, Option<OrdbogTilstand>> {
        let mut g = self.ordbog.lock().unwrap_or_else(|e| e.into_inner());
        // V-LAAS.2: låst læses intet (og intet huskes), så ordbogen ikke får en fejl, der hænger ved efter oplåsningen.
        if g.is_none() && !self.er_laast() {
            *g = Some(match &self.ordbogsfil {
                None => OrdbogTilstand::default(),
                Some(fil) => match fil.laes() {
                    Ok((taeller, poster)) => OrdbogTilstand::med(poster, taeller),
                    Err(fejl) => OrdbogTilstand {
                        fejl: Some(fejl),
                        ..OrdbogTilstand::default()
                    },
                },
            });
        }
        g
    }

    /// En kopi af kernens ordbog til én analyse.
    fn kerne_ordbog(&self) -> Ordbog {
        self.ordbog().as_ref().map(|o| o.kerne.clone()).unwrap_or_default()
    }

    /// Sand, hvis programmet skal spørge, før det lukkes: en midlertidig sag med poster, og brugeren har ikke allerede
    /// svaret (Gem som sag, Kassér).
    ///
    /// Kaldes på hovedtråden (menuen, vinduets lukkeknap); derfor ventes der ikke på sagens lås. Er den optaget (en
    /// maskering af en stor fil kører), spørger programmet hellere end at fryse vinduet (V-FIL.1).
    pub fn skal_spoerge_ved_luk(&self) -> bool {
        if self.afslut.load(Ordering::SeqCst) {
            return false;
        }
        match self.sag.try_lock() {
            Ok(a) => a.aaben.is_none() && a.sag.antal_poster() > 0,
            Err(std::sync::TryLockError::Poisoned(e)) => {
                let a = e.into_inner();
                a.aaben.is_none() && a.sag.antal_poster() > 0
            }
            Err(std::sync::TryLockError::WouldBlock) => true,
        }
    }

    /// Brugeren har svaret; programmet må lukke uden at spørge igen.
    pub fn tillad_afslut(&self) {
        self.afslut.store(true, Ordering::SeqCst);
    }
}

/// Erstatter den aktuelle sag og nulstiller den gamle i hukommelsen (strengene og nøglen).
fn erstat(a: &mut Aktuel, sag: Sag, aaben: Option<AabenSag>) {
    let gammel = std::mem::replace(&mut a.sag, sag);
    a.aaben = aaben;
    a.nr += 1;
    nulstil(gammel.til_data());
}

/// Nu i millisekunder siden 1970 (UTC). Uret bruges kun i skallen, aldrig i kernen.
fn nu_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// En kode, brugeren har skrevet i en række.
#[derive(Clone, Debug, Deserialize)]
pub struct Rettelse {
    /// Rækkens id.
    pub id: usize,
    /// Den ønskede kode.
    pub kode: String,
}

/// En afvist rettelse eller en ukendt række. Indeholder rækkens id og brugerens ønskede kode, aldrig en original.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RaekkeFejl {
    /// Rækkens id.
    pub id: usize,
    /// `kollision` | `ugyldig` | `flere_stavemaader` | `ukendt_raekke`
    pub fejl: &'static str,
    /// Den kode, brugeren ønskede.
    pub kode: String,
}

/// Fejl til UI'et. Ingen variant indeholder en original.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "art", rename_all = "snake_case")]
pub enum UiFejl {
    /// Teksten er større end [`MAKS_BYTES`].
    ForStor {
        /// Tekstens størrelse i bytes.
        bytes: usize,
        /// Grænsen.
        maks: usize,
    },
    /// Der er ingen tekst.
    TomTekst,
    /// En eller flere rettelser blev afvist; intet er gemt.
    Raekker {
        /// Fejlene pr. række.
        fejl: Vec<RaekkeFejl>,
    },
    /// Sagsdata kunne ikke kopieres (bør ikke kunne ske).
    Sagsdata {
        /// Kernens beskrivelse (uden originaler).
        hvad: String,
    },
    /// En sag på disk kunne ikke læses, skrives eller slettes. I `gem_og_masker` betyder det: intet er gemt, og der
    /// er ingen maskeret tekst.
    Sag {
        /// Årsagen (uden indhold).
        fejl: SagFejl,
    },
    /// Programmet har ingen mappe til sager (kun i tests uden arkiv).
    IngenArkiv,
    /// En ordbogspost blev afvist; intet er gemt. Fejlene pr. felt uden værdien.
    Ordbog {
        /// Fejlene.
        fejl: Vec<FeltFejl>,
    },
    /// Ordbogens fil kunne ikke åbnes ved start. Grimnir bruger en tom ordbog og ændrer ikke filen.
    OrdbogLaast {
        /// Årsagen.
        fejl: SagFejl,
    },
    /// Ordbogen kunne ikke gemmes; intet er ændret. Ved [`SagFejl::Konflikt`] er ordbogen læst igen fra disken.
    OrdbogFil {
        /// Årsagen.
        fejl: SagFejl,
    },
    /// Indstillingerne kunne ikke gemmes, eller et valg er ugyldigt (`fejl` er `None`).
    Indstillinger {
        /// Årsagen fra disken.
        fejl: Option<SagFejl>,
    },
    /// V-LAAS.2: Grimnir er låst. Intet er læst eller ændret; lås op først.
    Laast,
    /// V-FIL.1: en fil kunne ikke læses eller skrives.
    Fil {
        /// Årsagen (uden indhold og sti).
        fejl: FilFejl,
    },
    /// Der er ingen åben fil i visningen.
    IngenFil,
    /// Der er intet resultat at gemme eller kopiere (maskér eller demaskér først).
    IntetResultat,
    /// Den maskerede fil i hukommelsen hører til en sag, der ikke er åben længere; maskér igen.
    Foraeldet,
    /// Lækagetjekket fandt rester; filen gemmes kun med "Gem alligevel".
    Rester {
        /// Antal rester.
        antal: usize,
    },
    /// Den demaskerede fil gemmes kun efter brugerens bekræftelse.
    IkkeBekraeftet,
    /// Resultatet er for stort til udklipsholderen (over 5 MiB); gem det som fil.
    ForStorTilKopi {
        /// Resultatets størrelse i bytes (UTF-8).
        bytes: usize,
        /// Grænsen.
        maks: usize,
    },
}

impl From<FilFejl> for UiFejl {
    fn from(fejl: FilFejl) -> Self {
        UiFejl::Fil { fejl }
    }
}

impl From<Fejl> for UiFejl {
    fn from(f: Fejl) -> Self {
        UiFejl::Sagsdata { hvad: f.to_string() }
    }
}

impl From<SagFejl> for UiFejl {
    fn from(fejl: SagFejl) -> Self {
        UiFejl::Sag { fejl }
    }
}

/// Én række i tabellen: én enhed i teksten.
#[derive(Clone, Debug, Serialize)]
pub struct Raekke {
    /// Byte-position for enhedens første forekomst. Fast for samme tekst.
    pub id: usize,
    /// Fundets art (`ipv4_egen`, `vaert`, `hemmelighed` …).
    pub art: &'static str,
    /// `sikker` | `ordbog` | `sandsynlig` | `tjek` | `version`
    pub status: &'static str,
    /// Maskeres som standard (`Tjek selv`, `Version` og fremmede adresser gør ikke).
    pub standard: bool,
    /// Maskeres i dette valg.
    pub valgt: bool,
    /// Kan ikke slås fra: teksten har allerede en af sagens koder her, og demaskeringen ville ellers sætte en forkert
    /// værdi ind (kernens kollisionspas).
    pub laast: bool,
    /// Hemmelighed: vises som prikker, til brugeren trykker Vis.
    pub hemmelig: bool,
    /// Enhedens stavemåder i teksten (originalerne, til visning).
    pub vaerdier: Vec<String>,
    /// Koden for hver stavemåde. For en fravalgt række er det forslaget, hvis den slås til.
    pub koder: Vec<String>,
    /// Antal forekomster.
    pub antal: usize,
    /// Linjen for første forekomst (1-baseret).
    pub linje: usize,
    /// Brugeren har rettet koden.
    pub rettet: bool,
    /// Alle rækkens koder fandtes i sagen før denne tekst (kendt fra en tidligere maskering i denne session).
    pub kendt: bool,
}

/// En advarsel fra kernen, samlet pr. art og kode. Uden forslag (forslaget er en original).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct AdvarselUd {
    /// `ukendt_adresse` | `ukendt_kode` | `anden_stavemaade` | `fqdn_forkortet` | `domaene_alene` | `escaped` |
    /// `url_kodet` | `ikke_brugt` | `ligner_anden_sag` | `overloeb_egne_net` | `overloeb_fremmede` | `overloeb_mac` |
    /// `overloeb_ipv6`
    pub art: &'static str,
    /// Koden, det handler om (tom, hvis ingen).
    pub kode: String,
    /// Antal gange.
    pub antal: usize,
    /// Linjen for første gang (0 for advarsler uden sted).
    pub linje: usize,
}

/// Svaret fra `analyser`.
#[derive(Clone, Debug, Serialize)]
pub struct Analyse {
    /// Rækkerne i rækkefølge efter første forekomst.
    pub raekker: Vec<Raekke>,
    /// Rettelser, der ville blive afvist.
    pub fejl: Vec<RaekkeFejl>,
    /// Overløb under tildelingen.
    pub advarsler: Vec<AdvarselUd>,
    /// Tekstens størrelse i bytes.
    pub bytes: usize,
    /// Antal linjer.
    pub linjer: usize,
}

/// En rest fra lækagetjekket, samlet pr. art og tekst.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct RestUd {
    /// `original` (en af sagens originaler står stadig i teksten) | `nyt_fund` (genkenderne finder noget nyt).
    pub art: &'static str,
    /// Klassen eller fundets art.
    pub type_: &'static str,
    /// Teksten i det maskerede resultat (det er den, brugeren skal se for at afgøre det).
    pub tekst: String,
    /// Antal gange.
    pub antal: usize,
    /// Linjen for første gang.
    pub linje: usize,
}

/// Svaret fra `gem_og_masker`.
#[derive(Clone, Debug, Serialize)]
pub struct Maskering {
    /// Den maskerede tekst.
    pub maskeret: String,
    /// Rester fra lækagetjekket.
    pub rester: Vec<RestUd>,
    /// Overløb under tildelingen.
    pub advarsler: Vec<AdvarselUd>,
    /// Sagens antal poster efter gemningen.
    pub poster: usize,
}

/// Svaret fra `demasker`.
#[derive(Clone, Debug, Serialize)]
pub struct Demaskering {
    /// Teksten med de rigtige værdier.
    pub tekst: String,
    /// Kernens advarsler, samlet.
    pub advarsler: Vec<AdvarselUd>,
    /// Sagens koder, der forekommer i teksten (koderne, ikke originalerne).
    pub koder: Vec<String>,
    /// V-PUDS.1 N4: for hver kode i `koder`, i samme rækkefølge, hvor mange steder den blev sat tilbage, og linjen.
    pub tilbage: Vec<TilbageUd>,
    /// Antal linjer i den indsatte tekst ([`fil::antal_linjer`]; V-RET.1 R3).
    pub linjer: usize,
}

/// V-PUDS.1 N4: én kode, der blev sat tilbage: koden (ikke originalen), antal steder i teksten og linjen for det første
/// (1-baseret, som `linje` i Maskér; LF, CRLF og et enligt CR er hver ét linjeskift). Tallene kommer fra kernens
/// gennemløb, der byggede resultatet ([`grimnir_core::demasker_med_steder`]): stederne er dem, der blev erstattet (koden,
/// et alias eller koden med andre store/små bogstaver).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct TilbageUd {
    /// Koden.
    pub kode: String,
    /// Antal steder.
    pub antal: usize,
    /// Linjen for det første sted.
    pub linje: usize,
}

/// Svaret fra `sag_status` og kommandoerne, der skifter sag.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SagStatus {
    /// Antal stavemåder med kode i sagen.
    pub poster: usize,
    /// Den navngivne sags id (`None`: midlertidig sag).
    pub id: Option<String>,
    /// Den navngivne sags navn.
    pub navn: Option<String>,
    /// Udløbsdato `ÅÅÅÅ-MM-DD`.
    pub udloeb: Option<String>,
    /// Sagens valg (D4, D5).
    pub valg: ValgUd,
}

/// En sags valg til UI'et.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct ValgUd {
    /// Maskér fremmede offentlige adresser (D4).
    pub masker_fremmede: bool,
    /// Bevar sidste oktet i egne net (D5).
    pub bevar_sidste_oktet: bool,
}

impl From<Valg> for ValgUd {
    fn from(v: Valg) -> Self {
        ValgUd {
            masker_fremmede: v.masker_fremmede,
            bevar_sidste_oktet: v.bevar_sidste_oktet,
        }
    }
}

/// Én sag i listen.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct SagListePost {
    /// Sagens id (32 hextegn).
    pub id: String,
    /// Navnet (`None`, hvis sagen ikke kan åbnes).
    pub navn: Option<String>,
    /// Antal værdier (poster).
    pub poster: usize,
    /// Oprettet (ms siden 1970, UTC).
    pub oprettet: u64,
    /// Sidst gemt (ms siden 1970, UTC).
    pub sidst_brugt: u64,
    /// Udløbsdato.
    pub udloeb: Option<String>,
    /// Sagen er den, der er åben i dette vindue.
    pub aaben: bool,
    /// Årsagen, hvis sagen ikke kan åbnes ("Kan ikke åbnes").
    pub fejl: Option<SagFejl>,
}

// ------------------------------------------------------------------------------------------------------- navne til UI

/// Fundets art som nøgle til UI'et.
pub fn art_navn(a: Art) -> &'static str {
    match a {
        Art::Ipv4Egen => "ipv4_egen",
        Art::Ipv4Fremmed => "ipv4_fremmed",
        Art::Ipv6Egen => "ipv6_egen",
        Art::Ipv6Fremmed => "ipv6_fremmed",
        Art::Mac => "mac",
        Art::Vaert => "vaert",
        Art::Domaene => "domaene",
        Art::NetbiosDomaene => "netbios",
        Art::Bruger => "bruger",
        Art::Person => "person",
        Art::Database => "database",
        Art::Ord => "ord",
        Art::Hemmelighed => "hemmelighed",
        Art::Sid => "sid",
        Art::Guid => "guid",
        Art::Serienummer => "serienummer",
        Art::Cpr => "cpr",
        Art::Entropi => "entropi",
        Art::LignerKode => "ligner_kode",
    }
}

fn klasse_navn(k: Klasse) -> &'static str {
    match k {
        Klasse::Vaert => "vaert",
        Klasse::Domaene => "domaene",
        Klasse::Netbios => "netbios",
        Klasse::Bruger => "bruger",
        Klasse::Person => "person",
        Klasse::Database => "database",
        Klasse::Ord => "ord",
        Klasse::Hemmelighed => "hemmelighed",
        Klasse::Serie => "serienummer",
        Klasse::Cpr => "cpr",
        Klasse::Guid => "guid",
        Klasse::Sid => "sid",
        Klasse::Ipv4 => "ipv4_egen",
        Klasse::Ipv6 => "ipv6_egen",
        Klasse::Mac => "mac",
    }
}

fn status_navn(s: Sikkerhed) -> &'static str {
    match s {
        Sikkerhed::Sikker => "sikker",
        Sikkerhed::Ordbog => "ordbog",
        Sikkerhed::Sandsynlig => "sandsynlig",
        Sikkerhed::TjekSelv => "tjek",
        Sikkerhed::Version => "version",
    }
}

fn advarsel_navn(a: AdvarselArt) -> &'static str {
    match a {
        AdvarselArt::UkendtAdresseISagensNet => "ukendt_adresse",
        AdvarselArt::UkendtKode => "ukendt_kode",
        AdvarselArt::AfledtForm(AfledtArt::AndenStavemaade) => "anden_stavemaade",
        AdvarselArt::AfledtForm(AfledtArt::FqdnForkortet) => "fqdn_forkortet",
        AdvarselArt::AfledtForm(AfledtArt::DomaeneAlene) => "domaene_alene",
        AdvarselArt::AfledtForm(AfledtArt::Escaped) => "escaped",
        AdvarselArt::AfledtForm(AfledtArt::UrlKodet) => "url_kodet",
        AdvarselArt::IkkeBrugt => "ikke_brugt",
        AdvarselArt::LignerAndenSag => "ligner_anden_sag",
        AdvarselArt::Overloeb(Pulje::EgneNet) => "overloeb_egne_net",
        AdvarselArt::Overloeb(Pulje::Fremmede) => "overloeb_fremmede",
        AdvarselArt::Overloeb(Pulje::Mac) => "overloeb_mac",
        AdvarselArt::Overloeb(Pulje::Ipv6) => "overloeb_ipv6",
    }
}

// ------------------------------------------------------------------------------------------------------- hjælpere

/// Linjenumre ud fra byte-positioner (1-baseret). Bygges én gang pr. tekst med de samme linjeskift som
/// [`fil::antal_linjer`] (LF, CRLF og et enligt CR).
struct Linjer(Vec<usize>);

impl Linjer {
    fn ny(t: &str) -> Self {
        Linjer(fil::linjeskift_ved(t).collect())
    }
    fn af(&self, pos: usize) -> usize {
        self.0.partition_point(|&i| i < pos) + 1
    }
}

fn tjek_tekst(tekst: &str) -> Result<(), UiFejl> {
    tjek_tekst_op_til(tekst, MAKS_BYTES)
}

fn tjek_tekst_op_til(tekst: &str, maks: usize) -> Result<(), UiFejl> {
    if tekst.len() > maks {
        return Err(UiFejl::ForStor { bytes: tekst.len(), maks });
    }
    if tekst.is_empty() {
        return Err(UiFejl::TomTekst);
    }
    Ok(())
}

/// En kopi af sagen med `masker_fremmede` sat. Kernens `Sag` er ikke `Clone`; data er, og `fra_data` bygger indeksene.
fn kopi(sag: &Sag, masker_fremmede: bool) -> Result<Sag, Fejl> {
    let mut d = sag.data().clone();
    d.valg.masker_fremmede = masker_fremmede;
    Sag::fra_data(d)
}

/// Et fund, brugeren har slået til, selv om kernen ikke foreslår det (`Tjek selv`, `Version`).
fn slaaet_til(f: &Fund) -> Fund {
    let mut f = *f;
    if matches!(f.sikkerhed, Sikkerhed::TjekSelv | Sikkerhed::Version) {
        f.sikkerhed = Sikkerhed::Sandsynlig;
    }
    f
}

/// Som kernens `skal_maskeres` med sagens standardvalg: kernen ville selv foreslå fundet maskeret.
fn standard_for(f: &Fund, masker_fremmede: bool) -> bool {
    match f.sikkerhed {
        Sikkerhed::Version | Sikkerhed::TjekSelv => false,
        _ => !matches!(f.art, Art::Ipv4Fremmed | Art::Ipv6Fremmed) || masker_fremmede,
    }
}

fn samlede_advarsler(liste: &[Advarsel], linjer: &Linjer) -> Vec<AdvarselUd> {
    let mut ud: Vec<AdvarselUd> = Vec::new();
    let mut plads: HashMap<(&'static str, String), usize> = HashMap::new();
    for a in liste {
        let art = advarsel_navn(a.art);
        let linje = if a.slut > 0 { linjer.af(a.start) } else { 0 };
        match plads.get(&(art, a.kode.clone())) {
            Some(&i) => ud[i].antal += 1,
            None => {
                plads.insert((art, a.kode.clone()), ud.len());
                ud.push(AdvarselUd {
                    art,
                    kode: a.kode.clone(),
                    antal: 1,
                    linje,
                });
            }
        }
    }
    ud
}

// ------------------------------------------------------------------------------------------------------- beregning

/// En gruppe = én enhed i teksten = én række.
struct Gruppe {
    id: usize,
    art: Art,
    status: Sikkerhed,
    standard: bool,
    vaerdier: Vec<String>,
    forslag: Vec<String>,
}

struct Beregning {
    kladde: Sag,
    erstatninger: Vec<Erstatning>,
    raekker: Vec<Raekke>,
    fejl: Vec<RaekkeFejl>,
    advarsler: Vec<Advarsel>,
    /// Ordbogen for dette valg: brugerens ordbog, hvor "maskér aldrig" også har de fravalgte værdier, sagen allerede
    /// kender (dér virker F1). Bruges af lækagetjekket.
    aldrig: Ordbog,
    /// Alle fravalgte værdier med små bogstaver: lækagetjekkets rester sorteres mod dem.
    fravalgte: HashSet<String>,
    linjer: Linjer,
    /// V-KVIT.1: spændene for analysens fund (med brugerens ordbog), i tekstens rækkefølge.
    fund_spaend: Vec<(usize, usize)>,
}

/// Hvilke rækker der maskeres.
#[derive(Clone, Copy)]
enum Udvalg<'a> {
    /// Kernens standard.
    Standard,
    /// Alle undtagen disse rækker.
    Fravalgt(&'a [usize]),
    /// Kernens standard, undtagen de rækker, brugeren selv har slået til (`true`) eller fra (`false`). V-FIL.1: det,
    /// maskering.js gør i to kald for indsat tekst, når ordbogen ændres (`analyserIgen`), gør Rust i ét for en fil.
    Rort(&'a HashMap<usize, bool>),
}

/// Regner forslag, valg og rettelser ud på en kopi af sagen. Sagen selv røres ikke.
///
/// `udvalg`: rækker, der maskeres. `rettelser`: koder, brugeren har skrevet.
/// `ordbog`: brugerens ordbog (V-ORDBOG.1); den finder værdier, og "maskér aldrig" vinder over alt.
fn beregn(sag: &Sag, tekst: &str, udvalg: Udvalg<'_>, rettelser: &[Rettelse], ordbog: &Ordbog) -> Result<Beregning, UiFejl> {
    let linjer = Linjer::ny(tekst);
    let fund = kerne_analyser(tekst, ordbog);
    let fund_ved: HashMap<(usize, usize), &Fund> = fund.iter().map(|f| ((f.start, f.slut), f)).collect();
    let fremmede = sag.valg().masker_fremmede;

    // 1. Fuldt gennemløb: alt får en kode, så alle rækker og deres grupper kendes.
    let mut alle = kopi(sag, true)?;
    let fund_alle: Vec<Fund> = fund.iter().map(slaaet_til).collect();
    let ers_alle = foreslaa_med_ordbog(&fund_alle, tekst, &mut alle, ordbog);
    let post_af: HashMap<&str, usize> = alle.data().poster.iter().enumerate().map(|(i, p)| (p.kode.as_str(), i)).collect();
    let mut grupper: Vec<Gruppe> = Vec::new();
    let mut gruppe_af_enhed: HashMap<usize, usize> = HashMap::new();
    let mut gruppe_ved: HashMap<(usize, usize), usize> = HashMap::new();
    for e in &ers_alle {
        let Some(&p) = post_af.get(e.kode.as_str()) else { continue };
        let enhed = alle.data().poster[p].enhed;
        let gi = *gruppe_af_enhed.entry(enhed).or_insert_with(|| {
            grupper.push(Gruppe {
                id: e.start,
                art: e.art,
                status: Sikkerhed::Version,
                standard: false,
                vaerdier: Vec::new(),
                forslag: Vec::new(),
            });
            grupper.len() - 1
        });
        let g = &mut grupper[gi];
        gruppe_ved.insert((e.start, e.slut), gi);
        let o = e.original.som_tekst();
        if !g.vaerdier.iter().any(|v| v == o) {
            g.vaerdier.push(o.to_string());
            g.forslag.push(e.kode.clone());
        }
        // Et spænd uden fund er kernens eget (F1: kendt fra sagen; kollisionspasset): sikkert og standard.
        let (s, std) = match fund_ved.get(&(e.start, e.slut)) {
            Some(f) => (f.sikkerhed, standard_for(f, fremmede)),
            None => (Sikkerhed::Sikker, true),
        };
        g.status = g.status.min(s);
        g.standard |= std;
    }
    drop(post_af);
    drop(alle);

    let fra: Option<HashSet<usize>> = match udvalg {
        Udvalg::Fravalgt(f) => Some(f.iter().copied().collect()),
        _ => None,
    };
    let valgt: Vec<bool> = grupper
        .iter()
        .map(|g| match (&fra, udvalg) {
            (Some(f), _) => !f.contains(&g.id),
            (None, Udvalg::Rort(r)) => r.get(&g.id).copied().unwrap_or(g.standard),
            (None, _) => g.standard,
        })
        .collect();

    // 2. Gennemløbet, der gemmes: kun de valgte rækker. "Maskér aldrig" er ordbogens liste plus de fravalgte værdier,
    // som sagen kender i forvejen (F1 kan kun finde dem).
    let mut fravalgte: HashSet<String> = HashSet::new();
    for (g, v) in grupper.iter().zip(&valgt) {
        if !v {
            fravalgte.extend(g.vaerdier.iter().map(|x| x.to_ascii_lowercase()));
        }
    }
    let mut aldrig = ordbog.clone();
    if !fravalgte.is_empty() {
        let mut set = HashSet::new();
        for p in &sag.data().poster {
            let o = p.original.som_tekst().to_ascii_lowercase();
            if fravalgte.contains(&o) && set.insert(o) {
                aldrig.aldrig.push(p.original.som_tekst().to_string());
            }
        }
    }
    let fund_valgt: Vec<Fund> = fund
        .iter()
        .filter(|f| gruppe_ved.get(&(f.start, f.slut)).is_some_and(|&gi| valgt[gi]))
        .map(slaaet_til)
        .collect();
    let mut kladde = kopi(sag, true)?;
    let mut ers = foreslaa_med_ordbog(&fund_valgt, tekst, &mut kladde, &aldrig);
    let advarsler = kladde.tag_advarsler();
    let mut kladde = kopi(&kladde, fremmede)?;

    // Hver erstatning til sin række. Et spænd i en fravalgt række kan kun komme fra kollisionspasset: den er låst.
    let mut laast = vec![false; grupper.len()];
    let mut ers_gruppe: Vec<Option<usize>> = Vec::with_capacity(ers.len());
    for e in &ers {
        let gi = gruppe_ved.get(&(e.start, e.slut)).copied();
        if let Some(gi) = gi {
            if !valgt[gi] {
                laast[gi] = true;
            }
        }
        ers_gruppe.push(gi);
    }
    let effektiv: Vec<bool> = valgt.iter().zip(&laast).map(|(v, l)| *v || *l).collect();

    // Ekstra spænd, som det fulde gennemløb ikke havde (sjældent: et fravalg kan frilægge en kortere kendt værdi).
    let mut ekstra: HashMap<String, usize> = HashMap::new();
    for (i, e) in ers.iter().enumerate() {
        if ers_gruppe[i].is_none() {
            let gi = *ekstra.entry(e.kode.clone()).or_insert_with(|| {
                grupper.push(Gruppe {
                    id: e.start,
                    art: e.art,
                    status: Sikkerhed::Sikker,
                    standard: true,
                    vaerdier: Vec::new(),
                    forslag: Vec::new(),
                });
                laast.push(true);
                grupper.len() - 1
            });
            let o = e.original.som_tekst();
            if !grupper[gi].vaerdier.iter().any(|v| v == o) {
                grupper[gi].vaerdier.push(o.to_string());
                grupper[gi].forslag.push(e.kode.clone());
            }
            ers_gruppe[i] = Some(gi);
        }
    }
    let mut effektiv = effektiv;
    effektiv.resize(grupper.len(), true);

    // Koderne pr. række i dette valg.
    let mut koder: Vec<Vec<String>> = grupper.iter().map(|g| g.forslag.clone()).collect();
    let mut antal = vec![0usize; grupper.len()];
    let mut set_v: Vec<Vec<bool>> = grupper.iter().map(|g| vec![false; g.vaerdier.len()]).collect();
    for (i, e) in ers.iter().enumerate() {
        let Some(gi) = ers_gruppe[i] else { continue };
        antal[gi] += 1;
        if let Some(vi) = grupper[gi].vaerdier.iter().position(|v| v == e.original.som_tekst()) {
            if !set_v[gi][vi] {
                koder[gi][vi] = e.kode.clone();
                set_v[gi][vi] = true;
            }
        }
    }
    // En fravalgt række: antal fra det fulde gennemløb.
    for e in &ers_alle {
        if let Some(&gi) = gruppe_ved.get(&(e.start, e.slut)) {
            if !effektiv[gi] {
                antal[gi] += 1;
            }
        }
    }

    // 3. Rettelser.
    let mut rettet = vec![false; grupper.len()];
    let mut fejl = Vec::new();
    for r in rettelser {
        let ny = r.kode.as_str();
        let Some(gi) = grupper.iter().position(|g| g.id == r.id) else {
            fejl.push(RaekkeFejl {
                id: r.id,
                fejl: "ukendt_raekke",
                kode: r.kode.clone(),
            });
            continue;
        };
        if !effektiv[gi] {
            continue;
        }
        let mut forskellige = koder[gi].clone();
        forskellige.sort_unstable();
        forskellige.dedup();
        // Én kode: rettes som skrevet (`Sag::ret`). Flere stavemåder: hele enheden omdøbes samlet, og koden spejler
        // hver stavemådes store/små bogstaver (`Sag::ret_enhed`, fund 3 i V-SKAL.2).
        let svar = if forskellige.len() == 1 {
            if forskellige[0] == ny {
                continue;
            }
            kladde
                .ret(&forskellige[0], ny, tekst)
                .map(|()| vec![(forskellige[0].clone(), ny.to_string())])
        } else {
            kladde.ret_enhed(&koder[gi][0], ny, tekst)
        };
        match svar {
            Ok(par) => {
                let ny_for: HashMap<&str, &str> = par.iter().map(|(g, n)| (g.as_str(), n.as_str())).collect();
                for (i, e) in ers.iter_mut().enumerate() {
                    if ers_gruppe[i] == Some(gi) {
                        if let Some(n) = ny_for.get(e.kode.as_str()) {
                            e.kode = n.to_string();
                        }
                    }
                }
                for k in koder[gi].iter_mut() {
                    if let Some(n) = ny_for.get(k.as_str()) {
                        *k = n.to_string();
                    }
                }
                rettet[gi] = true;
            }
            Err(f) => fejl.push(RaekkeFejl {
                id: r.id,
                fejl: match f {
                    Fejl::KodeKolliderer { .. } => "kollision",
                    Fejl::UgyldigKode { .. } => "ugyldig",
                    _ => "ukendt_raekke",
                },
                kode: r.kode.clone(),
            }),
        }
    }

    let raekker = grupper
        .iter()
        .enumerate()
        .map(|(gi, g)| Raekke {
            id: g.id,
            art: art_navn(g.art),
            status: status_navn(g.status),
            standard: g.standard,
            valgt: effektiv[gi],
            laast: laast[gi],
            hemmelig: matches!(g.art, Art::Hemmelighed | Art::Entropi),
            vaerdier: g.vaerdier.clone(),
            koder: koder[gi].clone(),
            antal: antal[gi],
            linje: linjer.af(g.id),
            rettet: rettet[gi],
            kendt: !rettet[gi] && koder[gi].iter().all(|k| sag.opslag(k).is_some()),
        })
        .collect();
    Ok(Beregning {
        kladde,
        erstatninger: ers,
        raekker,
        fejl,
        advarsler,
        aldrig,
        fravalgte,
        linjer,
        fund_spaend: fund.iter().map(|f| (f.start, f.slut)).collect(),
    })
}

// ------------------------------------------------------------------------------------------------------- kvitteringen

/// V-KVIT.1: tallene pr. type for de rækker, der maskeres: antal rækker (værdier) og antal steder, i typeordenen
/// ([`kvit::ARTER`]). Summen af stederne er antallet af erstatninger.
fn typer_af(raekker: &[Raekke]) -> Vec<TypeTal> {
    let mut ud: Vec<TypeTal> = Vec::new();
    for r in raekker.iter().filter(|r| r.valgt) {
        match ud.iter_mut().find(|t| t.art == r.art) {
            Some(t) => {
                t.vaerdier += 1;
                t.steder += r.antal;
            }
            None => ud.push(TypeTal {
                art: r.art,
                vaerdier: 1,
                steder: r.antal,
            }),
        }
    }
    ud.sort_by_key(|t| kvit::plads(t.art));
    ud
}

/// V-KVIT.1: antal forskellige værdier (uafhængigt af store/små bogstaver) på "maskér aldrig", som analysen mødte i
/// teksten: fund, analysen gør uden listen, på steder, hvor den med listen intet finder (`med`: fundenes spænd med
/// brugerens ordbog). En tom liste koster intet; ellers ét gennemløb mere. Værdierne nulstilles; kun tallet kommer ud.
fn aldrig_moedt(tekst: &str, ordbog: &Ordbog, med: &[(usize, usize)]) -> usize {
    if ordbog.aldrig.is_empty() {
        return 0;
    }
    let mut uden = ordbog.clone();
    for a in uden.aldrig.iter_mut() {
        zeroize::Zeroize::zeroize(a);
    }
    uden.aldrig.clear();
    let fund = kerne_analyser(tekst, &uden);
    ob::nulstil_kerne(uden);
    // Spændene efter start, og den største slutning til og med hvert spænd: et fund overlapper et af dem, hvis et
    // spænd, der begynder før fundets slutning, slutter efter fundets begyndelse.
    let mut spaend = med.to_vec();
    spaend.sort_unstable();
    let mut stoerste = 0;
    let slut_til: Vec<usize> = spaend
        .iter()
        .map(|s| {
            stoerste = stoerste.max(s.1);
            stoerste
        })
        .collect();
    let mut set: HashSet<String> = HashSet::new();
    for f in &fund {
        let i = spaend.partition_point(|s| s.0 < f.slut);
        if i > 0 && slut_til[i - 1] > f.start {
            continue;
        }
        if let Some(v) = tekst.get(f.start..f.slut) {
            set.insert(v.to_lowercase());
        }
    }
    let n = set.len();
    for mut v in set {
        zeroize::Zeroize::zeroize(&mut v);
    }
    n
}

// ------------------------------------------------------------------------------------------------------- handlingerne

/// Finder fundene og regner koderne ud på en kladde af sagen. Sagen ændres ikke.
pub fn analyser(t: &Tilstand, tekst: &str, fravalgt: Option<&[usize]>, rettelser: &[Rettelse]) -> Result<Analyse, UiFejl> {
    t.aaben()?;
    // V-KVIT.1: en ny analyse af indsat tekst: kvitteringen for det gamle resultat findes ikke længere.
    *t.kvit_tekst() = None;
    tjek_tekst(tekst)?;
    analyser_i(t, tekst, fravalgt.map_or(Udvalg::Standard, Udvalg::Fravalgt), rettelser)
}

/// [`analyser`] uden tekstens grænse (en fil har sin egen, [`fil::MAKS_FIL`]).
fn analyser_i(t: &Tilstand, tekst: &str, udvalg: Udvalg<'_>, rettelser: &[Rettelse]) -> Result<Analyse, UiFejl> {
    let ordbog = t.kerne_ordbog();
    // Sagen kopieres under låsen; selve beregningen sker uden lås.
    let sag = {
        let laast = t.sag();
        kopi(&laast.sag, laast.sag.valg().masker_fremmede)?
    };
    let b = beregn(&sag, tekst, udvalg, rettelser, &ordbog);
    nulstil(sag.til_data());
    ob::nulstil_kerne(ordbog);
    let b = b?;
    let ud = Analyse {
        advarsler: samlede_advarsler(&b.advarsler, &b.linjer),
        linjer: fil::antal_linjer(tekst),
        raekker: b.raekker,
        fejl: b.fejl,
        bytes: tekst.len(),
    };
    ob::nulstil_kerne(b.aldrig);
    nulstil(b.kladde.til_data());
    Ok(ud)
}

/// Maskerer med brugerens valg og rettelser og gemmer sagen. Afvises en rettelse, gemmes intet. I en navngiven sag
/// skrives sagen krypteret til disk, før svaret sendes; fejler det, er intet ændret, og der er ingen maskeret tekst.
pub fn gem_og_masker(t: &Tilstand, tekst: &str, fravalgt: &[usize], rettelser: &[Rettelse]) -> Result<Maskering, UiFejl> {
    t.aaben()?;
    *t.kvit_tekst() = None;
    tjek_tekst(tekst)?;
    let (m, nr, tal) = gem_og_masker_i(t, tekst, fravalgt, rettelser)?;
    // V-KVIT.1: tallene til kvitteringen huskes. Porten tjekkes igen under låsen, så intet huskes efter [`laas_igen`].
    let mut k = t.kvit_tekst();
    if !t.er_laast() {
        *k = Some((nr, tal));
    }
    drop(k);
    Ok(m)
}

/// [`gem_og_masker`] uden tekstens grænse. Svarer også med sagens nummer efter gemningen og (V-KVIT.1) tallene til
/// kvitteringen.
fn gem_og_masker_i(t: &Tilstand, tekst: &str, fravalgt: &[usize], rettelser: &[Rettelse]) -> Result<(Maskering, u64, Tal), UiFejl> {
    let ordbog = t.kerne_ordbog();
    let mut a = match t.sag_aaben() {
        Ok(a) => a,
        Err(f) => {
            ob::nulstil_kerne(ordbog);
            return Err(f);
        }
    };
    let b = beregn(&a.sag, tekst, Udvalg::Fravalgt(fravalgt), rettelser, &ordbog);
    // V-KVIT.1: tallet regnes kun, når maskeringen gennemføres (ingen afvist rettelse).
    let aldrig = match &b {
        Ok(b) if b.fejl.is_empty() => aldrig_moedt(tekst, &ordbog, &b.fund_spaend),
        _ => 0,
    };
    ob::nulstil_kerne(ordbog);
    let b = b?;
    if !b.fejl.is_empty() {
        return Err(UiFejl::Raekker { fejl: b.fejl });
    }
    let (ms, forskel) = t.klokke().nu();
    let maskeret = masker(tekst, &b.erstatninger);
    let ud_linjer = Linjer::ny(&maskeret);
    let mut rester: Vec<RestUd> = Vec::new();
    let mut plads: HashMap<(&str, &str, &str), usize> = HashMap::new();
    for r in laekagetjek(&maskeret, &b.kladde, &b.aldrig) {
        let (art, type_) = match r.art {
            RestArt::Original(k) => ("original", klasse_navn(k)),
            RestArt::NytFund(a) => ("nyt_fund", art_navn(a)),
        };
        let tekst_r = &maskeret[r.start..r.slut];
        // Brugeren har valgt værdien fra: den står urørt med vilje og er ikke en rest.
        if b.fravalgte.contains(&tekst_r.to_ascii_lowercase()) {
            continue;
        }
        match plads.get(&(art, type_, tekst_r)) {
            Some(&i) => rester[i].antal += 1,
            None => {
                plads.insert((art, type_, tekst_r), rester.len());
                rester.push(RestUd {
                    art,
                    type_,
                    tekst: tekst_r.to_string(),
                    antal: 1,
                    linje: ud_linjer.af(r.start),
                })
            }
        }
    }
    let advarsler = samlede_advarsler(&b.advarsler, &b.linjer);
    let aktuel = &mut *a;
    if let Some(aaben) = aktuel.aaben.as_mut() {
        let mut hoved = aaben.hoved.clone();
        hoved.sidst_brugt = nu_ms();
        if let Err(f) = t
            .arkiv()
            .and_then(|ark| ark.gem(aaben, hoved, b.kladde.data()).map_err(UiFejl::from))
        {
            // Intet udleveres: den maskerede tekst nulstilles, og sagen i hukommelsen er uændret.
            let mut m = maskeret;
            zeroize::Zeroize::zeroize(&mut m);
            nulstil(b.kladde.til_data());
            return Err(f);
        }
    }
    let poster = b.kladde.antal_poster();
    let aaben = aktuel.aaben.take();
    ob::nulstil_kerne(b.aldrig);
    erstat(aktuel, b.kladde, aaben);
    let tal = Tal {
        ms,
        forskel,
        linjer: fil::antal_linjer(&maskeret),
        tegn: maskeret.chars().count(),
        typer: typer_af(&b.raekker),
        rester: rester.iter().map(|r| r.antal).sum(),
        fravalgt: b.raekker.iter().filter(|r| !r.valgt && r.standard).count(),
        ikke_foreslaaet: b.raekker.iter().filter(|r| !r.valgt && !r.standard).count(),
        aldrig,
    };
    Ok((
        Maskering {
            maskeret,
            rester,
            advarsler,
            poster,
        },
        aktuel.nr,
        tal,
    ))
}

/// Sætter sagens originaler tilbage i en tekst.
pub fn demasker(t: &Tilstand, tekst: &str) -> Result<Demaskering, UiFejl> {
    t.aaben()?;
    tjek_tekst_op_til(tekst, MAKS_DEMASKER)?;
    let d = demasker_i(t, tekst)?;
    if let Err(f) = husk_demaskeret(t, 0, &d.tekst) {
        // Låst imens: resultatet udleveres ikke og nulstilles.
        let mut x = d.tekst;
        zeroize::Zeroize::zeroize(&mut x);
        return Err(f);
    }
    Ok(d)
}

/// V-LAAS.4: husker fingeraftrykket af et demaskeret resultat (`i`: 0 indsat tekst, 1 filen), så et senere Kopiér kan
/// genkendes ([`udklip_kopieret`]). Porten tjekkes igen under låsen, så intet huskes efter [`laas_igen`].
fn husk_demaskeret(t: &Tilstand, i: usize, tekst: &str) -> Result<(), UiFejl> {
    let mut h = t.udklip_husk();
    t.aaben()?;
    h.demaskeret[i] = Some(h.fingeraftryk(tekst));
    Ok(())
}

/// [`demasker`] uden tekstens grænse.
fn demasker_i(t: &Tilstand, tekst: &str) -> Result<Demaskering, UiFejl> {
    let a = t.sag();
    let sag = &a.sag;
    let (ud, adv, steder) = kerne_demasker(tekst, sag);
    let ikke_brugt: HashSet<&str> = adv
        .iter()
        .filter(|a| a.art == AdvarselArt::IkkeBrugt)
        .map(|a| a.kode.as_str())
        .collect();
    // V-PUDS.1 N4: antal og første sted pr. post, fra samme gennemløb.
    let steder: HashMap<usize, (usize, usize)> = steder.iter().map(|s| (s.post, (s.antal, s.foerste))).collect();
    let linjer = Linjer::ny(tekst);
    let (koder, tilbage): (Vec<String>, Vec<TilbageUd>) = sag
        .data()
        .poster
        .iter()
        .enumerate()
        .filter(|(_, p)| !ikke_brugt.contains(p.kode.as_str()))
        .map(|(i, p)| {
            let (antal, linje) = steder.get(&i).map_or((0, 0), |&(n, f)| (n, linjer.af(f)));
            (
                p.kode.clone(),
                TilbageUd {
                    kode: p.kode.clone(),
                    antal,
                    linje,
                },
            )
        })
        .unzip();
    drop(a);
    Ok(Demaskering {
        advarsler: samlede_advarsler(&adv, &linjer),
        tekst: ud,
        koder,
        tilbage,
        linjer: fil::antal_linjer(tekst),
    })
}

fn status(a: &Aktuel) -> SagStatus {
    SagStatus {
        poster: a.sag.antal_poster(),
        id: a.aaben.as_ref().map(|x| x.id.hex()),
        navn: a.aaben.as_ref().map(|x| x.hoved.navn.clone()),
        udloeb: a.aaben.as_ref().and_then(|x| x.hoved.udloeb.clone()),
        valg: a.sag.valg().into(),
    }
}

/// Den aktuelle sag: antal poster, og navn og id, hvis den er navngiven. V-LAAS.2: [`UiFejl::Laast`], mens der er låst.
pub fn sag_status(t: &Tilstand) -> Result<SagStatus, UiFejl> {
    t.aaben()?;
    Ok(status(&t.sag()))
}

/// Tømmer sagen: en midlertidig sag kasseres; en navngiven lukkes (filen bliver). Som [`sag_luk`].
pub fn sag_nulstil(t: &Tilstand) -> Result<SagStatus, UiFejl> {
    sag_luk(t)
}

// ------------------------------------------------------------------------------------------------------- sager på disk

fn id_af(id: &str) -> Result<SagsId, UiFejl> {
    SagsId::fra_hex(id).map_err(UiFejl::from)
}

/// Gør den aktuelle sag til en navngiven sag på disk. En midlertidig sag (også med poster) bliver den nye sag; er en
/// navngiven sag åben, lukkes den (dens fil bliver), og den nye sag starter tom.
pub fn sag_ny(t: &Tilstand, navn: &str, udloeb: Option<&str>) -> Result<SagStatus, UiFejl> {
    t.aaben()?;
    let arkiv = t.arkiv()?;
    let ny = t.ny_sag();
    let mut a = t.sag_aaben()?;
    let data = if a.aaben.is_none() { a.sag.data() } else { ny.data() };
    let aaben = arkiv.opret(navn, udloeb.map(str::to_string), data, nu_ms())?;
    if a.aaben.is_some() {
        erstat(&mut a, ny, Some(aaben));
    } else {
        a.aaben = Some(aaben);
    }
    Ok(status(&a))
}

/// Sagerne på disk. En sag, der ikke kan åbnes, står med årsagen; intet slettes.
pub fn sag_liste(t: &Tilstand) -> Result<Vec<SagListePost>, UiFejl> {
    t.aaben()?;
    let arkiv = t.arkiv()?;
    let aaben_id = t.sag().aaben.as_ref().map(|x| x.id);
    let mut ud: Vec<SagListePost> = arkiv
        .liste()?
        .into_iter()
        .map(|p| {
            let aaben = Some(p.id) == aaben_id;
            match p.hoved {
                Ok(h) => SagListePost {
                    id: p.id.hex(),
                    navn: Some(h.navn),
                    poster: h.poster,
                    oprettet: h.oprettet,
                    sidst_brugt: h.sidst_brugt,
                    udloeb: h.udloeb,
                    aaben,
                    fejl: None,
                },
                Err(f) => SagListePost {
                    id: p.id.hex(),
                    navn: None,
                    poster: 0,
                    oprettet: 0,
                    sidst_brugt: 0,
                    udloeb: None,
                    aaben,
                    fejl: Some(f),
                },
            }
        })
        .collect();
    ud.sort_by(|a, b| b.sidst_brugt.cmp(&a.sidst_brugt).then_with(|| a.id.cmp(&b.id)));
    Ok(ud)
}

/// Åbner en sag fra disk og gør den til den aktuelle. Den tidligere sag nulstilles i hukommelsen (UI'et spørger først,
/// hvis den var midlertidig med poster). Er sagen allerede åben, læses den igen fra disk (efter en konflikt).
pub fn sag_aabn(t: &Tilstand, id: &str) -> Result<SagStatus, UiFejl> {
    t.aaben()?;
    let id = id_af(id)?;
    let (aaben, data) = t.arkiv()?.aabn(&id)?;
    let sag = Sag::fra_data(data).map_err(|_| UiFejl::from(SagFejl::Beskadiget))?;
    let mut a = match t.sag_aaben() {
        Ok(a) => a,
        Err(f) => {
            // Låst, mens sagen blev læst: den læste sag og nøglen slippes og nulstilles.
            nulstil(sag.til_data());
            drop(aaben);
            return Err(f);
        }
    };
    erstat(&mut a, sag, Some(aaben));
    Ok(status(&a))
}

/// Lukker sagen: den nulstilles i hukommelsen, og en ny, tom midlertidig sag starter. En navngiven sags fil bliver.
pub fn sag_luk(t: &Tilstand) -> Result<SagStatus, UiFejl> {
    t.aaben()?;
    let ny = t.ny_sag();
    let mut a = t.sag();
    erstat(&mut a, ny, None);
    Ok(status(&a))
}

/// Ændrer hovedet på en sag: den åbne (med kontrol af skrivetælleren) eller en anden på disk.
fn ret_hoved(t: &Tilstand, id: &SagsId, aendr: impl FnOnce(&mut crate::sager::Hoved)) -> Result<(), UiFejl> {
    let arkiv = t.arkiv()?;
    let mut a = t.sag();
    let aktuel = &mut *a;
    match aktuel.aaben.as_mut().filter(|x| x.id == *id) {
        Some(aaben) => {
            let mut h = aaben.hoved.clone();
            aendr(&mut h);
            arkiv.gem(aaben, h, aktuel.sag.data())?;
        }
        None => {
            drop(a);
            arkiv.ret_hoved(id, aendr)?;
        }
    }
    Ok(())
}

/// Omdøber en sag.
pub fn sag_omdoeb(t: &Tilstand, id: &str, navn: &str) -> Result<(), UiFejl> {
    t.aaben()?;
    let id = id_af(id)?;
    let navn = rens_navn(navn)?;
    ret_hoved(t, &id, |h| h.navn = navn)
}

/// Sætter eller fjerner en sags udløbsdato (`ÅÅÅÅ-MM-DD`). En udløbet sag slettes ikke automatisk.
pub fn sag_udloeb(t: &Tilstand, id: &str, dato: Option<&str>) -> Result<(), UiFejl> {
    t.aaben()?;
    let id = id_af(id)?;
    if let Some(d) = dato {
        tjek_dato(d)?;
    }
    let dato = dato.map(str::to_string);
    ret_hoved(t, &id, |h| h.udloeb = dato)
}

/// Sletter en sags fil og nøgle (UI'et bekræfter med sagens navn først). Er sagen åben, lukkes den.
pub fn sag_slet(t: &Tilstand, id: &str) -> Result<SagStatus, UiFejl> {
    t.aaben()?;
    let id = id_af(id)?;
    t.arkiv()?.slet(&id)?;
    let ny = t.ny_sag();
    let mut a = t.sag();
    if a.aaben.as_ref().is_some_and(|x| x.id == id) {
        erstat(&mut a, ny, None);
    }
    Ok(status(&a))
}

/// Ændrer valget (D4, D5) for den åbne sag. Koderne for værdier, sagen allerede har, ændres ikke; valget gælder nye
/// værdier. En navngiven sag gemmes (med kontrol af skrivetælleren).
pub fn sag_valg(t: &Tilstand, masker_fremmede: bool, bevar_sidste_oktet: bool) -> Result<SagStatus, UiFejl> {
    t.aaben()?;
    let mut a = t.sag_aaben()?;
    let mut d = a.sag.data().clone();
    d.valg = Valg {
        masker_fremmede,
        bevar_sidste_oktet,
    };
    let ny = Sag::fra_data(d)?;
    let aktuel = &mut *a;
    if let Some(aaben) = aktuel.aaben.as_mut() {
        let h = aaben.hoved.clone();
        if let Err(f) = t.arkiv().and_then(|ark| ark.gem(aaben, h, ny.data()).map_err(UiFejl::from)) {
            nulstil(ny.til_data());
            return Err(f);
        }
    }
    let aaben = aktuel.aaben.take();
    erstat(aktuel, ny, aaben);
    Ok(status(aktuel))
}

// ------------------------------------------------------------------------------------------------------- ordbogen

/// Ordbogen til UI'et: posterne og fejlen, hvis filen ikke kunne åbnes (så er listen tom, og ændringer afvises).
#[derive(Clone, Serialize)]
pub struct OrdbogUd {
    /// Posterne i den rækkefølge, de er tilføjet.
    pub poster: Vec<OrdbogPost>,
    /// Årsagen, hvis filen ikke kunne åbnes.
    pub fejl: Option<SagFejl>,
}

fn ordbog_ud(o: &OrdbogTilstand) -> OrdbogUd {
    OrdbogUd {
        poster: o.poster.clone(),
        fejl: o.fejl.clone(),
    }
}

/// Ordbogen. V-LAAS.2: [`UiFejl::Laast`], mens der er låst (ordbogen læses ikke).
pub fn ordbog_hent(t: &Tilstand) -> Result<OrdbogUd, UiFejl> {
    t.aaben()?;
    let g = t.ordbog();
    Ok(g.as_ref().map(ordbog_ud).unwrap_or(OrdbogUd {
        poster: Vec::new(),
        fejl: None,
    }))
}

/// Ændrer ordbogen: `aendr` får en kopi af posterne. Gemmes kopien, bliver den ordbogen; fejler noget, er intet ændret.
fn aendr_ordbog(t: &Tilstand, aendr: impl FnOnce(&mut Vec<OrdbogPost>) -> Result<(), UiFejl>) -> Result<OrdbogUd, UiFejl> {
    let mut g = t.ordbog();
    // V-LAAS.3: låst, efter porten blev passeret: læg ikke en tom ordbog i tilstanden (den ville ikke blive læst igen).
    t.aaben()?;
    let o = g.get_or_insert_with(OrdbogTilstand::default);
    if let Some(f) = &o.fejl {
        return Err(UiFejl::OrdbogLaast { fejl: f.clone() });
    }
    let mut nye = o.poster.clone();
    if let Err(f) = aendr(&mut nye) {
        ob::nulstil(nye);
        return Err(f);
    }
    if let Some(fil) = &t.ordbogsfil {
        match fil.gem(o.taeller, &nye) {
            Ok(n) => o.taeller = n,
            Err(fejl) => {
                ob::nulstil(nye);
                if fejl == SagFejl::Konflikt {
                    // Ændret et andet sted: læs den igen, så brugeren ser den gældende ordbog og kan prøve igen.
                    match fil.laes() {
                        Ok((n, poster)) => {
                            o.erstat(poster);
                            o.taeller = n;
                        }
                        Err(f) => {
                            o.erstat(Vec::new());
                            o.fejl = Some(f);
                        }
                    }
                }
                return Err(UiFejl::OrdbogFil { fejl });
            }
        }
    }
    o.erstat(nye);
    Ok(ordbog_ud(o))
}

fn post_type(type_: &str) -> Result<PostType, UiFejl> {
    PostType::fra_navn(type_).ok_or(UiFejl::Ordbog {
        fejl: vec![ob::felt("type", "ukendt_type")],
    })
}

/// Tilføjer en post. Afvises den, er intet gemt, og fejlene står pr. felt.
pub fn ordbog_tilfoej(t: &Tilstand, type_: &str, vaerdi: &str, note: Option<&str>) -> Result<OrdbogUd, UiFejl> {
    t.aaben()?;
    let type_ = post_type(type_)?;
    aendr_ordbog(t, |poster| {
        let (vaerdi, note) = ob::valider(poster, type_, vaerdi, note, None).map_err(|fejl| UiFejl::Ordbog { fejl })?;
        let id = poster.iter().map(|p| p.id).max().unwrap_or(0) + 1;
        poster.push(OrdbogPost {
            id,
            type_,
            vaerdi,
            note,
            oprettet: nu_ms(),
        });
        Ok(())
    })
}

fn ukendt_post() -> UiFejl {
    UiFejl::Ordbog {
        fejl: vec![ob::felt("id", "ukendt_post")],
    }
}

/// Retter en posts værdi og note (typen bliver).
pub fn ordbog_ret(t: &Tilstand, id: u64, vaerdi: &str, note: Option<&str>) -> Result<OrdbogUd, UiFejl> {
    t.aaben()?;
    aendr_ordbog(t, |poster| {
        let i = poster.iter().position(|p| p.id == id).ok_or_else(ukendt_post)?;
        let (v, n) = ob::valider(poster, poster[i].type_, vaerdi, note, Some(id)).map_err(|fejl| UiFejl::Ordbog { fejl })?;
        let p = &mut poster[i];
        zeroize::Zeroize::zeroize(&mut p.vaerdi);
        p.vaerdi = v;
        if let Some(gammel) = p.note.as_mut() {
            zeroize::Zeroize::zeroize(gammel);
        }
        p.note = n;
        Ok(())
    })
}

/// Fjerner en post.
pub fn ordbog_fjern(t: &Tilstand, id: u64) -> Result<OrdbogUd, UiFejl> {
    t.aaben()?;
    aendr_ordbog(t, |poster| {
        let i = poster.iter().position(|p| p.id == id).ok_or_else(ukendt_post)?;
        ob::nulstil(vec![poster.remove(i)]);
        Ok(())
    })
}

/// Et fund i "Prøv på tekst", samlet pr. tekst.
#[derive(Clone, Debug, Serialize)]
pub struct ProevFund {
    /// `fanget` (ordbogen finder værdien) | `aldrig` (genkenderne fandt den, men den står på "maskér aldrig").
    pub status: &'static str,
    /// Fundets art (som i Maskér).
    pub art: &'static str,
    /// Teksten i den indsatte tekst.
    pub tekst: String,
    /// Antal gange.
    pub antal: usize,
    /// Linjen for første gang.
    pub linje: usize,
}

/// Svaret fra "Prøv på tekst".
#[derive(Clone, Debug, Serialize)]
pub struct Proeve {
    /// Fundene.
    pub fund: Vec<ProevFund>,
    /// Antal fund i alt fra genkenderne og ordbogen (også dem, der ikke kommer fra ordbogen).
    pub i_alt: usize,
}

/// Kører analysen med ordbogen på en tekst og svarer med det, ordbogen fanger, og det, "maskér aldrig" beskytter.
/// Sagen røres ikke, og teksten gemmes ingen steder.
pub fn ordbog_proev(t: &Tilstand, tekst: &str) -> Result<Proeve, UiFejl> {
    t.aaben()?;
    tjek_tekst(tekst)?;
    let ordbog = t.kerne_ordbog();
    let med = kerne_analyser(tekst, &ordbog);
    let uden = kerne_analyser(tekst, &Ordbog::ny());
    ob::nulstil_kerne(ordbog);
    let linjer = Linjer::ny(tekst);
    let mut ud: Vec<ProevFund> = Vec::new();
    let mut plads: HashMap<(&'static str, String), usize> = HashMap::new();
    let mut laeg = |status: &'static str, f: &Fund| {
        let tekst_f = tekst[f.start..f.slut].to_string();
        match plads.get(&(status, tekst_f.to_lowercase())) {
            Some(&i) => ud[i].antal += 1,
            None => {
                plads.insert((status, tekst_f.to_lowercase()), ud.len());
                ud.push(ProevFund {
                    status,
                    art: art_navn(f.art),
                    tekst: tekst_f,
                    antal: 1,
                    linje: linjer.af(f.start),
                });
            }
        }
    };
    for f in med.iter().filter(|f| f.sikkerhed == Sikkerhed::Ordbog) {
        laeg("fanget", f);
    }
    // Et fund uden ordbog, som ordbogen har fjernet uden at sætte noget andet på samme sted: "maskér aldrig".
    for f in &uden {
        if !med.iter().any(|m| m.start < f.slut && f.start < m.slut) {
            laeg("aldrig", f);
        }
    }
    Ok(Proeve {
        fund: ud,
        i_alt: med.len(),
    })
}

// ------------------------------------------------------------------------------------------------------- indstillinger

/// Indstillingerne.
pub fn indstillinger_hent(t: &Tilstand) -> Indstillinger {
    t.indstillinger()
}

/// Gemmer indstillingerne. Uden mappe (tests) gælder de kun i hukommelsen. Virker også, mens Grimnir er låst.
///
/// V-LAAS.3: "Lås efter stilstand" skal være 5, 15, 30 eller 60 minutter; alt andet afvises (låsen kan ikke slås fra).
pub fn indstillinger_gem(t: &Tilstand, ny: Indstillinger) -> Result<Indstillinger, UiFejl> {
    if !ny.gyldig() {
        return Err(UiFejl::Indstillinger { fejl: None });
    }
    let mut g = t.indst.lock().unwrap_or_else(|e| e.into_inner());
    skriv_indstillinger(t, &mut g, ny)
}

/// Skriver indstillingerne (under låsen `g`) og gør dem gældende.
fn skriv_indstillinger(t: &Tilstand, g: &mut Indstillinger, ny: Indstillinger) -> Result<Indstillinger, UiFejl> {
    if let Some(fil) = &t.indst_fil {
        if let Some(m) = fil.parent() {
            opret_mappe(m).map_err(|f| UiFejl::Indstillinger { fejl: Some(f) })?;
        }
        indstillinger::gem(fil, &ny).map_err(|f| UiFejl::Indstillinger { fejl: Some(f) })?;
    }
    *g = ny;
    Ok(ny)
}

// ------------------------------------------------------------------------------------------------------- låsen (V-LAAS.2)

/// Låsens tilstand til UI'et. Intet fra sagerne.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct LaasStatus {
    /// Grimnir er låst.
    pub laast: bool,
    /// V-LAAS.3: Grimnir er låst igen efter start, og hvorfor (`dvale` | `skaerm_slukket` | `brugerskift` |
    /// `stilstand`). Så længe den er sat, kalder UI'et ikke `laas_op` af sig selv; dialogen kommer først, når brugeren
    /// trykker "Lås op". `null` ved start og efter oplåsning.
    pub igen: Option<Udloeser>,
    /// Grimnir er låst op uden bekræftelse, fordi maskinen ikke kan bekræfte brugeren: `ingen_adgangskode` |
    /// `platform`. UI'et viser så et vedvarende banner ("Grimnir er ikke låst").
    pub uden_doer: Option<&'static str>,
}

/// Svaret fra [`laas_op`]: dørens svar (`svar`, og `hvorfor` eller `kode`), låsens tilstand bagefter og, når denne
/// oplåsning fulgte efter [`laas_igen`], det, brugeren skal have at vide (`efter`; ellers `null`).
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct LaasSvar {
    /// Dørens svar.
    #[serde(flatten)]
    pub svar: Svar,
    /// Låsen bagefter.
    pub status: LaasStatus,
    /// V-LAAS.3: beskeder fra seneste [`laas_igen`] (gives én gang, ved oplåsningen).
    pub efter: Option<EfterLaas>,
}

/// Låsens tilstand. Virker altid.
pub fn laas_status(t: &Tilstand) -> LaasStatus {
    LaasStatus {
        laast: t.er_laast(),
        igen: *t.laas.igen.lock().unwrap_or_else(|e| e.into_inner()),
        uden_doer: *t.laas.uden_doer.lock().unwrap_or_else(|e| e.into_inner()),
    }
}

/// Lås op efter dørens svar: `Ok` låser op; `IkkeTilgaengelig` låser op uden bekræftelse (banneret); `Annulleret`,
/// `Afvist` og `Fejl` lader Grimnir være låst. Ved oplåsning svares der med beskederne fra seneste [`laas_igen`].
fn efter_svar(t: &Tilstand, svar: &Svar) -> Option<EfterLaas> {
    if matches!(svar, Svar::Annulleret | Svar::Afvist | Svar::Fejl { .. }) {
        return None;
    }
    // V-LAAS.4: en lås, der er i gang (fx venter på Nøglering), gøres færdig, før porten åbner og beskederne gives ud.
    let _koerer = t.laas.koerer.lock().unwrap_or_else(|e| e.into_inner());
    match svar {
        Svar::Ok => t.laas_op_uden_doer(None),
        Svar::IkkeTilgaengelig { hvorfor } => t.laas_op_uden_doer(Some(hvorfor)),
        Svar::Annulleret | Svar::Afvist | Svar::Fejl { .. } => return None,
    }
    *t.laas.igen.lock().unwrap_or_else(|e| e.into_inner()) = None;
    t.aktivitet();
    let efter = std::mem::take(&mut *t.laas.efter.lock().unwrap_or_else(|e| e.into_inner()));
    // V-LAAS.6 N2: navnet fra sidste afslutning er nu givet videre (eller var der ikke); det siges kun én gang.
    if let Some(f) = &t.gemt_fil {
        indstillinger::glem_gemt_navn(f);
    }
    (!efter.tom()).then_some(efter)
}

/// Låser op med døren (`sprog`: UI'ets sprog til dialogens tekst). Er Grimnir allerede låst op (fx af et andet tryk på
/// "Lås op", der kom først), spørges døren ikke, og svaret er `Ok`. Døren spørges højst én gang ad gangen. Nøglerne
/// læses først, når kommandoerne bruger dem (de blev sluppet ved [`laas_igen`]).
pub fn laas_op(t: &Tilstand, doer: &dyn Doer, sprog: &str) -> LaasSvar {
    t.saet_sprog(sprog);
    let _en_ad_gangen = t.laas.doer.lock().unwrap_or_else(|e| e.into_inner());
    let (svar, efter) = if t.er_laast() {
        let svar = doer.laas_op(&begrundelse(Grund::Start, sprog));
        let efter = efter_svar(t, &svar);
        (svar, efter)
    } else {
        (Svar::Ok, None)
    };
    LaasSvar {
        svar,
        status: laas_status(t),
        efter,
    }
}

/// V-LAAS.3 N2: låser Grimnir igen (dvale, skærmen slukker, brugerskift, stilstand). Svarer sand, hvis Grimnir var låst
/// op (så skal webvisningen have hændelsen `laast`); falsk, hvis den allerede var låst.
///
/// Rækkefølgen (V-LAAS.4):
/// 0. `koerer` tages og holdes til sidst: en oplåsning ([`laas_op`]) venter, til låsen er færdig, så porten ikke åbner
///    midt i den, og beskederne er skrevet, før de gives ud. To låse på én gang (dvale og skærm) kører efter hinanden.
/// 1. Låst sættes først: porten ([`Tilstand::aaben`]) og vagten om nøglelageret afviser alt nyt herfra, fra alle tråde.
///    Et senere `laas_op` er nødvendigt for at komme ind igen, og UI'et kalder det ikke af sig selv ([`LaasStatus::igen`]).
/// 2. Udklipsholderen ryddes, hvis den stadig har den demaskerede tekst, Grimnir lagde der ([`udklip_kopieret`]), og
///    fingeraftrykkene glemmes.
/// 3. De holdte filer i Maskér og Demaskér slippes; teksten, rækkernes originaler og resultaterne nulstilles (`Drop`).
///    En kommando, der kører på en fil, gøres færdig først (filens lås).
/// 4. Sagen. Sagens lås tages; en kommando, der holder den (en maskering), gøres færdig først, og en kommando, der kom
///    forbi porten lige før trin 1, tjekker porten igen efter låsen ([`Tilstand::sag_aaben`]) og lægger intet tilbage.
///    Med sagens lås holdt åbner vagten om nøglelageret for **denne tråd alene** ([`Undtagelse`]; V-LAAS.6: trinnet er
///    [`gem_og_nulstil_sag`], som [`ved_afslut`] også bruger):
///    - en navngiven sag, der er ændret uden at være gemt, gemmes med sin egen nøgle;
///    - en midlertidig sag med poster gemmes som navngiven sag ([`gem_midlertidig`]): navnet `Midlertidig ÅÅÅÅ-MM-DD
///      TT.MM.SS`, ny nøgle i nøglelageret og standardudløbet fra indstillingerne. Andre sagers nøgler læses ikke
///      (V-LAAS.5 N2: ingen navneliste).
///
///    Undtagelsen slippes, før sagen erstattes. Fejler en gemning (nøglelager eller disk), låses der alligevel, og fejlen
///    (uden indhold) vises efter oplåsningen. Sagen erstattes af en ny, tom midlertidig sag; den gamle sags strenge
///    nulstilles, og `AabenSag` med sagens [`Noegle`] slippes (nøglen nulstilles).
/// 5. Ordbogen slippes, og posterne og kernens kopi nulstilles. Den læses igen fra disk, første gang den bruges efter
///    oplåsningen (og nøglen med den).
/// 6. V-PUDS.1 N1: blev en midlertidig sag gemt, skrives navnet også i `<app-data>/gemt-ved-afslut.json`
///    ([`husk_gemt_navn`]), så beskeden kommer, selv om programmet afsluttes fra låseskærmen. Oplåsningen
///    ([`efter_svar`]) siger det og sletter filen.
///
/// Hvorfor ikke gemme først og låse bagefter: så stod porten åben for kommandoer fra webvisningen, mens nøglen blev
/// oprettet (måske i lang tid, hvis Nøglering spørger). Hvorfor ikke slå vagten fra for alle et øjeblik: en kommando, der
/// kom forbi porten før trin 1 (fx `sag_liste`), kunne så læse nøgler midt i låsen. Undtagelsen gælder kun den tråd,
/// der låser, og kun mens den holder sagens lås (testen `kommando_midt_i_laasen_svarer_laast`).
///
/// Låsene tages i samme orden som ellers (filer før sag; ordbogens aldrig samtidig med sagens; indstillingerne læses,
/// før sagens lås tages).
pub fn laas_igen(t: &Tilstand, grund: Udloeser) -> bool {
    let _koerer = t.laas.koerer.lock().unwrap_or_else(|e| e.into_inner());
    // 1. Låst.
    let var_aaben = !t.laas.laast.swap(true, Ordering::SeqCst);
    *t.laas.uden_doer.lock().unwrap_or_else(|e| e.into_inner()) = None;
    *t.laas.igen.lock().unwrap_or_else(|e| e.into_inner()) = Some(grund);
    // 2. Udklipsholderen.
    ryd_udklip(t);
    // 3. Filerne, og (V-KVIT.1) tallene til kvitteringen for indsat tekst.
    for v in [Visning::Masker, Visning::Demasker] {
        let gammel = t.fil(v).take();
        drop(gammel);
    }
    *t.kvit_tekst() = None;
    // 4. Sagen.
    let ny = t.ny_sag();
    let indst = t.indstillinger();
    let engelsk = t.engelsk.load(Ordering::SeqCst);
    let Gemt { midlertidig, gem_fejl } = gem_og_nulstil_sag(t, &mut t.sag(), ny, &indst, engelsk);
    // 5. Ordbogen.
    {
        let mut g = t.ordbog.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(o) = g.take() {
            ob::nulstil(o.poster);
            ob::nulstil_kerne(o.kerne);
        }
    }
    // 6. V-PUDS.1 N1: navnet også på disk, så beskeden overlever en afslutning fra låseskærmen.
    if let Some(Ok(navn)) = &midlertidig {
        husk_gemt_navn(t, navn);
    }
    let mut efter = t.laas.efter.lock().unwrap_or_else(|e| e.into_inner());
    match midlertidig {
        Some(Ok(navn)) => efter.midlertidig_gemt = Some(navn),
        Some(Err(f)) => efter.midlertidig_fejl = Some(f),
        None => {}
    }
    if gem_fejl.is_some() {
        efter.gem_fejl = gem_fejl;
    }
    var_aaben
}

/// Det, [`gem_og_nulstil_sag`] gemte: den midlertidige sag (navnet eller fejlen; `None`: der var ingen at gemme) og en
/// fejl ved gemningen af en ændret navngiven sag.
struct Gemt {
    midlertidig: Option<Result<String, SagFejl>>,
    gem_fejl: Option<SagFejl>,
}

/// V-LAAS.4 trin 4 i [`laas_igen`], og (V-LAAS.6 N1) det samme i [`ved_afslut`]: den ene funktion, der gemmer sagen og
/// nulstiller den. Kaldes med sagens lås holdt (`aktuel`) og **efter** låst er sat, så porten og vagten om nøglelageret
/// afviser alle andre tråde. Med sagens lås holdt åbner vagten for denne tråd alene ([`Undtagelse`]):
/// - en navngiven sag, der er ændret uden at være gemt, gemmes med sin egen nøgle;
/// - en midlertidig sag med poster gemmes som navngiven sag ([`gem_midlertidig`]: ét opslag i nøglelageret, den nye
///   nøgle);
/// - en uændret navngiven sag og en tom midlertidig sag gemmes ikke.
///
/// Undtagelsen slippes, før sagen erstattes af `ny` (en tom midlertidig sag); den gamle sags strenge nulstilles, og
/// `AabenSag` med sagens [`Noegle`] slippes (nøglen nulstilles).
fn gem_og_nulstil_sag(t: &Tilstand, aktuel: &mut Aktuel, ny: Sag, indst: &Indstillinger, engelsk: bool) -> Gemt {
    debug_assert!(t.er_laast(), "låst sættes, før sagen gemmes");
    let mut gemt = Gemt {
        midlertidig: None,
        gem_fejl: None,
    };
    let undtagelse = Undtagelse::ny(&t.laas.undtagelse);
    match aktuel.aaben.as_mut() {
        Some(aaben) if aktuel.ugemt => {
            let hoved = aaben.hoved.clone();
            if let Err(f) = t
                .arkiv()
                .map_err(|_| SagFejl::ManglerFil)
                .and_then(|ark| ark.gem(aaben, hoved, aktuel.sag.data()))
            {
                gemt.gem_fejl = Some(f);
            }
        }
        Some(_) => {}
        None if aktuel.sag.antal_poster() > 0 => {
            gemt.midlertidig = Some(gem_midlertidig(t, &aktuel.sag, indst, engelsk));
        }
        None => {}
    }
    drop(undtagelse);
    erstat(aktuel, ny, None);
    aktuel.ugemt = false;
    gemt
}

/// V-LAAS.4 N1: gemmer en midlertidig sag som navngiven sag, som `sag_ny` gør det ([`Arkiv::opret`]: ny nøgle i
/// nøglelageret og ny fil). Navnet er `Midlertidig ÅÅÅÅ-MM-DD TT.MM.SS` (lokal tid fra [`Tilstand::klokke`]; `Temporary …`
/// på engelsk); det står kun i sagens krypterede hoved. Udløbet er standardudløbet fra indstillingerne. Den åbnede sag
/// slippes straks (nøglen nulstilles); den står i sagslisten.
///
/// V-LAAS.5 N2 (ADR D22): de eksisterende sagers navne læses ikke ([`Arkiv::liste`] ville hente hver sags nøgle i
/// nøglelageret lige før dvale). Det eneste opslag i nøglelageret er oprettelsen af den nye sags nøgle. Sekunderne i
/// navnet gør et sammenfald usandsynligt; sker det alligevel (to låse i samme sekund, eller en sag, brugeren selv har
/// kaldt det samme), får de to sager samme navn, hvad der også er tilladt for navne, brugeren giver.
///
/// Kaldes kun fra [`gem_og_nulstil_sag`] ([`laas_igen`] og [`ved_afslut`]), med sagens lås og vagtens undtagelse for
/// denne tråd.
fn gem_midlertidig(t: &Tilstand, sag: &Sag, indst: &Indstillinger, engelsk: bool) -> Result<String, SagFejl> {
    let ark = t.arkiv().map_err(|_| SagFejl::ManglerFil)?;
    let (ms, forskel) = t.klokke().nu();
    let tid = klokke::lokal(ms, forskel);
    let navn = format!("{} {}", if engelsk { "Temporary" } else { "Midlertidig" }, tid.tekst());
    let udloeb = indst.udloeb_dage.map(|d| tid.dato_om(d));
    let aaben = ark.opret(&navn, udloeb, sag.data(), ms)?;
    drop(aaben);
    Ok(navn)
}

/// V-LAAS.4 N2, ved [`laas_igen`] og (V-LAAS.5 N1) [`ved_afslut`]: står udklipsholderens tæller stadig, hvor den stod
/// lige efter et genkendt Kopiér i Demaskér, ryddes den. Ellers har nogen skrevet til den siden, og den røres ikke.
/// Fingeraftrykkene glemmes. Kun tælleren læses og `clearContents` kaldes; teksten læses ikke (ingen dialog), og ingen
/// anden lås end `udklip_husk` tages (den holdes kun om de korte kald til udklipsholderen).
fn ryd_udklip(t: &Tilstand) {
    let mut h = t.udklip_husk();
    h.demaskeret = [None, None];
    if let (Some(c), Some(u)) = (h.taeller.take(), t.udklip.as_deref()) {
        if u.taeller() == Some(c) {
            u.ryd();
        }
    }
}

/// V-LAAS.5 N1 (ADR D22): programmet afslutter. Udklipsholderen ryddes på samme betingelse som ved lås ([`ryd_udklip`]):
/// kun efter Grimnirs egen melding om en demaskeret kopi ([`udklip_kopieret`]) og med uændret tæller. Maskeret tekst og
/// andre programmers indhold røres ikke.
///
/// Kaldes ét sted: `lib.rs` ved Tauris `RunEvent::Exit`, som hver vej ud af programmet ender i (`program_afslut`, ⌘Q og
/// menuens Afslut, lukkeknappen på det sidste vindue, Afslut fra Dock og log ud/sluk, der beder programmet afslutte).
///
/// **V-LAAS.6 N1: den midlertidige sag.** Har brugeren ikke svaret på spørgsmålet ved afslut (hverken Gem som sag eller
/// Kassér, [`Tilstand::tillad_afslut`]), fordi programmet afslutter ad en vej, der ikke spørger (Afslut fra Dock, log
/// ud, genstart, sluk), gemmes en midlertidig sag med poster som ved lås, med den samme funktion
/// ([`gem_og_nulstil_sag`]): navnet `Midlertidig ÅÅÅÅ-MM-DD TT.MM.SS` / `Temporary …`, standardudløbet og en ny nøgle.
/// Navnet skrives i `<app-data>/gemt-ved-afslut.json` og siges efter næste oplåsning (N2). Rækkefølgen:
/// 1. Udklipsholderen ryddes (som før; hurtig, kun tæller og `clearContents`).
/// 2. Har brugeren svaret, eller er Grimnir låst (låsen har gemt sagen, eller er i gang med det), sker der ikke mere.
/// 3. `koerer` tages, men kun hvis den er ledig (`try_lock`): er den optaget, er en lås ([`laas_igen`]) eller en
///    oplåsning i gang. Låsen gemmer selv sagen, og under en oplåsning er sagen tom (Grimnir var låst). Der ventes
///    aldrig på en lås, der står og venter på Nøglering.
/// 4. Låst sættes, som i [`laas_igen`]: porten og vagten om nøglelageret afviser alle andre tråde herfra.
/// 5. Sagens lås tages; en kommando, der holder den (fx en maskering), får højst [`AFSLUT_VENT`] til at blive færdig.
///    Derefter [`gem_og_nulstil_sag`] (vagtens undtagelse for denne tråd alene, mens sagens lås holdes).
/// 6. Lykkedes gemningen af en midlertidig sag, skrives navnet ([`husk_gemt_navn`]).
///
/// Fejler gemningen, afslutter programmet alligevel: fejlen vises ikke (der er ingen at vise den til) og skrives
/// ingen steder; [`crate::sager::Arkiv::opret`] sletter den nye nøgle igen, hvis filen ikke kunne skrives.
pub fn ved_afslut(t: &Tilstand) {
    // 1. Udklipsholderen.
    ryd_udklip(t);
    // 2. Svaret, eller låst.
    if t.afslut.load(Ordering::SeqCst) || t.er_laast() {
        return;
    }
    // 3. Ingen lås eller oplåsning i gang.
    let _koerer = match t.laas.koerer.try_lock() {
        Ok(g) => g,
        Err(std::sync::TryLockError::Poisoned(e)) => e.into_inner(),
        Err(std::sync::TryLockError::WouldBlock) => return,
    };
    // 4. Låst.
    if t.laas.laast.swap(true, Ordering::SeqCst) {
        return;
    }
    // 5. Sagen (indstillingerne og den nye sag læses, før sagens lås tages, som i laas_igen).
    let ny = t.ny_sag();
    let indst = t.indstillinger();
    let engelsk = t.engelsk.load(Ordering::SeqCst);
    let Some(mut a) = t.sag_inden(AFSLUT_VENT) else {
        return;
    };
    let gemt = gem_og_nulstil_sag(t, &mut a, ny, &indst, engelsk);
    drop(a);
    // 6. Navnet til næste start.
    if let Some(Ok(navn)) = &gemt.midlertidig {
        husk_gemt_navn(t, navn);
    }
}

/// V-LAAS.6 N2 og V-PUDS.1 N1: skriver navnet på en midlertidig sag, der lige er gemt (af [`ved_afslut`] eller
/// [`laas_igen`]), i `<app-data>/gemt-ved-afslut.json` ([`indstillinger::gem_gemt_navn`]: kun Grimnirs eget navn).
/// Næste oplåsning, i samme kørsel eller ved næste start, siger det og sletter filen ([`efter_svar`]); så gives beskeden
/// én gang, også når programmet afsluttes fra låseskærmen. Fejl ved skrivningen ignoreres (så mangler kun beskeden ved
/// næste start; sagen står i listen). Fejlbeskederne (`midlertidig_fejl`, `gem_fejl`) skrives ikke til disk.
fn husk_gemt_navn(t: &Tilstand, navn: &str) {
    if let Some(f) = &t.gemt_fil {
        let _ = indstillinger::gem_gemt_navn(f, navn);
    }
}

/// V-LAAS.6 N1: så længe [`ved_afslut`] højst venter på sagens lås, mens en kommando gør sig færdig. Derefter afslutter
/// programmet uden at gemme (afslutningen må ikke hænge på en kommando, der fx venter på en dialog fra Nøglering).
pub const AFSLUT_VENT: std::time::Duration = std::time::Duration::from_secs(2);

/// V-LAAS.4 N2: webvisningen har kopieret det demaskerede resultat (Kopiér i Demaskér; `fil`: filens resultat, ellers
/// den indsatte teksts). Rust husker udklipsholderens tæller, hvis indholdet er Grimnirs: teksten sammenlignes med
/// fingeraftrykket af det, Rust demaskerede, når den må læses uden besked til brugeren ([`crate::udklip`]); ellers
/// bruges tælleren alene. Svarer sand, hvis tælleren er husket. Teksten fra udklipsholderen gemmes ikke og logges ikke.
pub fn udklip_kopieret(t: &Tilstand, fil: bool) -> Result<bool, UiFejl> {
    t.aaben()?;
    let Some(u) = t.udklip.as_deref() else {
        return Ok(false);
    };
    let mut h = t.udklip_husk();
    t.aaben()?;
    h.taeller = None;
    let Some(fa) = h.demaskeret[usize::from(fil)] else {
        return Ok(false);
    };
    let Some(foer) = u.taeller() else {
        return Ok(false);
    };
    match u.tekst() {
        Indhold::Tekst(tekst) => {
            if h.fingeraftryk(&tekst) != fa {
                return Ok(false);
            }
        }
        Indhold::Ingen => return Ok(false),
        Indhold::MaaIkkeLaeses => {}
    }
    if u.taeller() != Some(foer) {
        return Ok(false);
    }
    h.taeller = Some(foer);
    Ok(true)
}

/// V-LAAS.3 N2: låser ved stilstand, når der har været stille i den valgte tid ("Lås efter stilstand"; 5, 15, 30 eller
/// 60 minutter) og ingen kommando er i gang. Kaldes jævnligt fra en tråd i `lib.rs`. Svarer som [`laas_igen`]; er
/// Grimnir allerede låst, sker der intet.
pub fn tjek_stilstand(t: &Tilstand) -> bool {
    if t.er_laast() || !t.stilstand.udloebet(t.indstillinger().laas_efter_min) {
        return false;
    }
    laas_igen(t, Udloeser::Stilstand)
}

/// Testkrog (V-LAAS.3 N5): det, tilstanden holder i hukommelsen, felt for felt (forbi porten). Efter [`laas_igen`] skal
/// alt være nul. `Arkiv` og `Ordbogsfil` holder ingen nøgler, kun nøglelageret (vagten om Nøglering), så de tælles ikke.
#[doc(hidden)]
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Levende {
    /// Nøgler: den åbne navngivne sags [`Noegle`] (i `AabenSag`).
    pub noegler: usize,
    /// Originaler i sagen i hukommelsen (én pr. post).
    pub originaler: usize,
    /// Ordbogens poster i hukommelsen.
    pub ordbogsvaerdier: usize,
    /// Ordbogen er læst (posterne og kernens kopi ligger i hukommelsen).
    pub ordbog_laest: bool,
    /// Holdte filer (Maskér og Demaskér) med tekst og rækker.
    pub filer: usize,
    /// Resultater i hukommelsen (maskeret eller demaskeret tekst).
    pub resultater: usize,
    /// V-LAAS.4: fingeraftryk af demaskerede resultater og en husket tæller for udklipsholderen.
    pub udklip: usize,
}

/// Testkrog (V-LAAS.3 N5): tæller [`Levende`].
#[doc(hidden)]
pub fn levende(t: &Tilstand) -> Levende {
    let mut l = Levende::default();
    for v in [Visning::Masker, Visning::Demasker] {
        if let Some(h) = t.fil(v).as_ref() {
            l.filer += 1;
            l.resultater += usize::from(h.resultat.is_some());
        }
    }
    {
        let a = t.sag();
        l.noegler = usize::from(a.aaben.is_some());
        l.originaler = a.sag.antal_poster();
    }
    if let Some(o) = t.ordbog.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        l.ordbog_laest = true;
        l.ordbogsvaerdier = o.poster.len();
    }
    {
        let h = t.udklip_husk();
        l.udklip = h.demaskeret.iter().flatten().count() + usize::from(h.taeller.is_some());
    }
    l
}

/// Testkrog (V-LAAS.4 N4): åbner en sag fra disk forbi porten (som en kommando, der kom forbi porten lige før
/// [`laas_igen`]), så testene kan se, at vagten om nøglelageret afviser alle andre tråde midt i låsen. Den læste sag og
/// nøglen slippes straks.
#[doc(hidden)]
pub fn aabn_forbi_porten(t: &Tilstand, id: &str) -> Result<(), SagFejl> {
    let id = SagsId::fra_hex(id)?;
    let (aaben, data) = t.arkiv().map_err(|_| SagFejl::ManglerFil)?.aabn(&id)?;
    drop(aaben);
    nulstil(data);
    Ok(())
}

/// Testkrog (V-LAAS.3 N5): markerer den åbne navngivne sag som ændret uden at være gemt, så testene kan prøve, at
/// [`laas_igen`] gemmer den. Ingen kommando i programmet kalder den (se [`Aktuel`]).
#[doc(hidden)]
pub fn marker_ugemt(t: &Tilstand) {
    let mut a = t.sag();
    if a.aaben.is_some() {
        a.ugemt = true;
    }
}

// ------------------------------------------------------------------------------------------------------- filer (V-FIL.1)

/// Visningen, en fil hører til.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Visning {
    /// Maskér: originalen.
    Masker,
    /// Demaskér: den maskerede fil, der er kommet tilbage.
    Demasker,
}

impl Visning {
    fn i(self) -> usize {
        match self {
            Visning::Masker => 0,
            Visning::Demasker => 1,
        }
    }
}

/// Et resultat i hukommelsen: den maskerede eller demaskerede tekst. Nulstilles, når det slippes.
struct Resultat {
    tekst: String,
    /// Antal rester fra lækagetjekket (Maskér).
    rester: usize,
    /// Sagens nummer, da teksten blev maskeret (Maskér; `None` under Demaskér).
    sag_nr: Option<u64>,
    /// V-KVIT.1: tallene til kvitteringen (Maskér; `None` under Demaskér).
    kvit: Option<Tal>,
}

impl Drop for Resultat {
    fn drop(&mut self) {
        zeroize::Zeroize::zeroize(&mut self.tekst);
    }
}

/// En åben fil (F2): teksten, rækkerne fra seneste analyse og resultatet bliver i Rust; webvisningen får filnavnet,
/// tallene, et uddrag og én side rækker ad gangen.
pub struct HoldtFil {
    fil: Fil,
    raekker: Vec<Raekke>,
    fejl: Vec<RaekkeFejl>,
    resultat: Option<Resultat>,
}

/// Nulstiller rækkernes originaler.
fn nulstil_raekker(raekker: &mut Vec<Raekke>) {
    for r in raekker.iter_mut() {
        for v in r.vaerdier.iter_mut() {
            zeroize::Zeroize::zeroize(v);
        }
    }
    raekker.clear();
}

impl Drop for HoldtFil {
    fn drop(&mut self) {
        nulstil_raekker(&mut self.raekker);
    }
}

impl Tilstand {
    /// Låsen til visningens fil (tages før sagens; Maskérs før Demaskérs).
    fn fil(&self, v: Visning) -> MutexGuard<'_, Option<HoldtFil>> {
        self.filer[v.i()].lock().unwrap_or_else(|e| e.into_inner())
    }

    /// Stierne til de åbne filer: dem skriver Grimnir aldrig til. Hver lås tages for sig.
    fn aabne_stier(&self) -> Vec<PathBuf> {
        [Visning::Masker, Visning::Demasker]
            .iter()
            .filter_map(|&v| self.fil(v).as_ref().map(|h| h.fil.sti.clone()))
            .collect()
    }
}

/// Det, webvisningen får at vide om en åben fil. Ingen sti.
#[derive(Clone, Debug, Serialize)]
pub struct FilInfo {
    /// Filnavnet.
    pub navn: String,
    /// Størrelsen i bytes.
    pub bytes: u64,
    /// Tegnsættet.
    pub tegnsaet: Tegnsaet,
    /// Linjeskiftene.
    pub linjeskift: Linjeskift,
    /// Antal linjer.
    pub linjer: usize,
    /// De første 200 000 tegn.
    pub uddrag: String,
    /// Antal tegn efter uddraget, der ikke vises.
    pub ikke_vist: usize,
}

/// Åbner en fil i visningen. En tidligere fil i samme visning slippes (og nulstilles). Filen læses, før låsen tages.
pub fn fil_aabn(t: &Tilstand, v: Visning, sti: &std::path::Path) -> Result<FilInfo, UiFejl> {
    t.aaben()?;
    let f = fil::laes(sti)?;
    let (uddrag, ikke_vist) = fil::uddrag(&f.tekst);
    let info = FilInfo {
        navn: f.navn.clone(),
        bytes: f.bytes,
        tegnsaet: f.tegnsaet,
        linjeskift: f.linjeskift,
        linjer: f.linjer(),
        uddrag,
        ikke_vist,
    };
    let ny = HoldtFil {
        fil: f,
        raekker: Vec::new(),
        fejl: Vec::new(),
        resultat: None,
    };
    let mut g = t.fil(v);
    // V-LAAS.3: låst, mens filen blev læst: den læste tekst slippes (og nulstilles) i stedet for at blive holdt.
    t.aaben()?;
    let gammel = g.replace(ny);
    drop(g);
    drop(gammel);
    Ok(info)
}

/// Slipper visningens fil (brugeren har sat tekst ind i stedet). Teksten og resultatet nulstilles.
pub fn fil_luk(t: &Tilstand, v: Visning) -> Result<(), UiFejl> {
    t.aaben()?;
    let gammel = t.fil(v).take();
    drop(gammel);
    Ok(())
}

/// Filter, søgning og sidestørrelse for rækkerne i en fil (som maskering.js gør det for indsat tekst).
#[derive(Clone, Debug, Default, Deserialize)]
#[serde(default)]
pub struct SideValg {
    /// `alle` | `tjek` | `hemmelig` | `seneste`
    pub filter: String,
    /// Søgeteksten (koder; værdier undtagen skjulte hemmeligheder).
    pub soeg: String,
    /// Hemmeligheder, brugeren har trykket Vis på (rækkernes id); kun dem søges der i.
    pub vist: Vec<usize>,
    /// Antal rækker, der sendes (500, 1000 …).
    pub antal: usize,
}

/// Største side: så mange rækker sendes højst ad gangen.
pub const MAKS_SIDE: usize = 50_000;

/// Antallene i træet (over alle rækker).
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct TraeAntal {
    /// Alle rækker.
    pub alle: usize,
    /// "Skal tjekkes": status `tjek` eller en afvist rettelse.
    pub tjek: usize,
    /// Hemmeligheder.
    pub hemmelig: usize,
    /// Kendt fra sagen.
    pub seneste: usize,
    /// Kun status `tjek` (StatusChip'en).
    pub status_tjek: usize,
}

/// Én side rækker og tallene over alle.
#[derive(Clone, Debug, Serialize)]
pub struct RaekkeSide {
    /// De første `antal` rækker efter filter og søgning.
    pub raekker: Vec<Raekke>,
    /// Antal rækker efter filter og søgning.
    pub i_alt: usize,
    /// Træets antal.
    pub antal: TraeAntal,
    /// Antal rækker, der maskeres.
    pub valgte: usize,
}

fn side_af(raekker: &[Raekke], fejl: &[RaekkeFejl], valg: &SideValg) -> RaekkeSide {
    let med_fejl: HashSet<usize> = fejl.iter().map(|f| f.id).collect();
    let tjek = |r: &Raekke| r.status == "tjek" || med_fejl.contains(&r.id);
    let antal = TraeAntal {
        alle: raekker.len(),
        tjek: raekker.iter().filter(|r| tjek(r)).count(),
        hemmelig: raekker.iter().filter(|r| r.hemmelig).count(),
        seneste: raekker.iter().filter(|r| r.kendt).count(),
        status_tjek: raekker.iter().filter(|r| r.status == "tjek").count(),
    };
    let q = valg.soeg.trim().to_lowercase();
    let vist: HashSet<usize> = valg.vist.iter().copied().collect();
    let passer = |r: &&Raekke| {
        let i_filter = match valg.filter.as_str() {
            "tjek" => tjek(r),
            "hemmelig" => r.hemmelig,
            "seneste" => r.kendt,
            _ => true,
        };
        i_filter
            && (q.is_empty()
                || r.koder.iter().any(|k| k.to_lowercase().contains(&q))
                || ((!r.hemmelig || vist.contains(&r.id)) && r.vaerdier.iter().any(|v| v.to_lowercase().contains(&q))))
    };
    let antal_side = valg.antal.clamp(1, MAKS_SIDE);
    let mut i_alt = 0;
    let mut side = Vec::new();
    for r in raekker.iter().filter(passer) {
        if side.len() < antal_side {
            side.push(r.clone());
        }
        i_alt += 1;
    }
    RaekkeSide {
        raekker: side,
        i_alt,
        antal,
        valgte: raekker.iter().filter(|r| r.valgt).count(),
    }
}

/// Svaret fra `fil_analyser`.
#[derive(Clone, Debug, Serialize)]
pub struct FilAnalyse {
    /// Første side rækker efter `side`.
    pub side: RaekkeSide,
    /// Rettelser, der ville blive afvist.
    pub fejl: Vec<RaekkeFejl>,
    /// Overløb under tildelingen.
    pub advarsler: Vec<AdvarselUd>,
    /// Filens størrelse i bytes.
    pub bytes: u64,
    /// Antal linjer.
    pub linjer: usize,
    /// Alle rækker, der ikke maskeres (id'er), så webvisningen kender valget uden at have alle rækker.
    pub fravalgt: Vec<usize>,
}

/// `analyser` for den åbne fil i Maskér. `rort` (vinder over `fravalgt`): kernens standard undtagen rækker, brugeren
/// selv har slået til eller fra. Et tidligere resultat slippes (valget kan være ændret).
pub fn fil_analyser(
    t: &Tilstand,
    fravalgt: Option<&[usize]>,
    rort: Option<&[(usize, bool)]>,
    rettelser: &[Rettelse],
    side: &SideValg,
) -> Result<FilAnalyse, UiFejl> {
    t.aaben()?;
    let mut g = t.fil(Visning::Masker);
    let h = g.as_mut().ok_or(UiFejl::IngenFil)?;
    h.resultat = None;
    let rort: Option<HashMap<usize, bool>> = rort.map(|r| r.iter().copied().collect());
    let udvalg = match (&rort, fravalgt) {
        (Some(r), _) => Udvalg::Rort(r),
        (None, Some(f)) => Udvalg::Fravalgt(f),
        (None, None) => Udvalg::Standard,
    };
    let a = analyser_i(t, &h.fil.tekst, udvalg, rettelser)?;
    let mut gamle = std::mem::replace(&mut h.raekker, a.raekker);
    nulstil_raekker(&mut gamle);
    h.fejl = a.fejl.clone();
    Ok(FilAnalyse {
        side: side_af(&h.raekker, &h.fejl, side),
        fravalgt: h.raekker.iter().filter(|r| !r.valgt).map(|r| r.id).collect(),
        fejl: a.fejl,
        advarsler: a.advarsler,
        bytes: h.fil.bytes,
        linjer: a.linjer,
    })
}

/// En ny side rækker fra seneste analyse (filter, søgning, "Vis flere").
pub fn fil_raekker(t: &Tilstand, side: &SideValg) -> Result<RaekkeSide, UiFejl> {
    t.aaben()?;
    let g = t.fil(Visning::Masker);
    let h = g.as_ref().ok_or(UiFejl::IngenFil)?;
    Ok(side_af(&h.raekker, &h.fejl, side))
}

/// Svaret fra `fil_gem_og_masker`.
#[derive(Clone, Debug, Serialize)]
pub struct FilMaskering {
    /// De første 200 000 tegn af den maskerede tekst.
    pub uddrag: String,
    /// Antal tegn, der ikke vises.
    pub ikke_vist: usize,
    /// Rester fra lækagetjekket.
    pub rester: Vec<RestUd>,
    /// Overløb under tildelingen.
    pub advarsler: Vec<AdvarselUd>,
    /// Sagens antal poster efter gemningen.
    pub poster: usize,
    /// Den maskerede teksts størrelse (UTF-8).
    pub bytes: usize,
    /// Kopiér kan bruges (højst 5 MiB).
    pub kopierbar: bool,
}

/// `gem_og_masker` for den åbne fil i Maskér: sagen gemmes (i en navngiven sag krypteret på disken), og den maskerede
/// tekst bliver i Rust til "Gem maskeret fil". Fejler gemningen, er der intet resultat, og ingen fil kan gemmes.
pub fn fil_gem_og_masker(t: &Tilstand, fravalgt: &[usize], rettelser: &[Rettelse]) -> Result<FilMaskering, UiFejl> {
    t.aaben()?;
    let mut g = t.fil(Visning::Masker);
    let h = g.as_mut().ok_or(UiFejl::IngenFil)?;
    h.resultat = None;
    let (m, nr, tal) = gem_og_masker_i(t, &h.fil.tekst, fravalgt, rettelser)?;
    let (uddrag, ikke_vist) = fil::uddrag(&m.maskeret);
    let bytes = m.maskeret.len();
    let rester = m.rester.iter().map(|r| r.antal).sum();
    h.resultat = Some(Resultat {
        tekst: m.maskeret,
        rester,
        sag_nr: Some(nr),
        kvit: Some(tal),
    });
    Ok(FilMaskering {
        uddrag,
        ikke_vist,
        rester: m.rester,
        advarsler: m.advarsler,
        poster: m.poster,
        bytes,
        kopierbar: bytes <= fil::MAKS_KOPI,
    })
}

/// Svaret fra `fil_demasker`.
#[derive(Clone, Debug, Serialize)]
pub struct FilDemaskering {
    /// De første 200 000 tegn af teksten med de rigtige værdier.
    pub uddrag: String,
    /// Antal tegn, der ikke vises.
    pub ikke_vist: usize,
    /// Kernens advarsler, samlet.
    pub advarsler: Vec<AdvarselUd>,
    /// Sagens koder, der forekommer i teksten.
    pub koder: Vec<String>,
    /// V-PUDS.1 N4: antal steder og første linje for hver kode i `koder` (som [`Demaskering::tilbage`]).
    pub tilbage: Vec<TilbageUd>,
    /// Tekstens størrelse (UTF-8).
    pub bytes: usize,
    /// Kopiér kan bruges (højst 5 MiB).
    pub kopierbar: bool,
}

/// `demasker` for den åbne fil i Demaskér. Teksten med de rigtige værdier bliver i Rust til "Gem som fil".
pub fn fil_demasker(t: &Tilstand) -> Result<FilDemaskering, UiFejl> {
    t.aaben()?;
    let mut g = t.fil(Visning::Demasker);
    let h = g.as_mut().ok_or(UiFejl::IngenFil)?;
    h.resultat = None;
    let d = demasker_i(t, &h.fil.tekst)?;
    if let Err(f) = husk_demaskeret(t, 1, &d.tekst) {
        let mut x = d.tekst;
        zeroize::Zeroize::zeroize(&mut x);
        return Err(f);
    }
    let (uddrag, ikke_vist) = fil::uddrag(&d.tekst);
    let bytes = d.tekst.len();
    h.resultat = Some(Resultat {
        tekst: d.tekst,
        rester: 0,
        sag_nr: None,
        kvit: None,
    });
    Ok(FilDemaskering {
        uddrag,
        ikke_vist,
        advarsler: d.advarsler,
        koder: d.koder,
        tilbage: d.tilbage,
        bytes,
        kopierbar: bytes <= fil::MAKS_KOPI,
    })
}

/// Hele resultatet til udklipsholderen (Kopiér), højst 5 MiB.
pub fn fil_kopi(t: &Tilstand, v: Visning) -> Result<String, UiFejl> {
    t.aaben()?;
    let g = t.fil(v);
    let r = g.as_ref().ok_or(UiFejl::IngenFil)?.resultat.as_ref().ok_or(UiFejl::IntetResultat)?;
    if r.tekst.len() > fil::MAKS_KOPI {
        return Err(UiFejl::ForStorTilKopi {
            bytes: r.tekst.len(),
            maks: fil::MAKS_KOPI,
        });
    }
    Ok(r.tekst.clone())
}

/// V-KVIT.1: kvitteringen for seneste maskering i Maskér som ren tekst på UI'ets sprog (`sprog`: `da` | `en`); `fil`: den
/// åbne fils resultat, ellers den indsatte teksts. Teksten bygges af tallene fra maskeringen ([`Tal`]) og sagens navn;
/// ingen original, kode eller sti, og heller ikke filens navn ([`crate::kvittering`]).
///
/// [`UiFejl::Laast`], mens der er låst. [`UiFejl::IntetResultat`], når der ikke er et maskeret resultat: før en
/// maskering, efter en ny analyse, og når sagen er en anden end den, der maskerede (Nulstil, Luk, en anden sag åbnet,
/// sagens valg ændret). [`UiFejl::IngenFil`], hvis `fil` er sat, og ingen fil er åben. Sagen og udklipsholderen røres
/// ikke, og intet meldes til [`udklip_kopieret`]: kvitteringen er lavet til at blive delt.
pub fn kvittering(t: &Tilstand, fil: bool, sprog: &str) -> Result<String, UiFejl> {
    t.aaben()?;
    let engelsk = sprog == "en";
    // Sagens navn nu, hvis sagen stadig er den, der maskerede (en midlertidig sag, der siden er gemt som sag, har fået
    // sit navn). Sagens lås tages efter filens eller tallenes, som ellers.
    let navn_for = |nr: Option<u64>| -> Result<Option<String>, UiFejl> {
        let a = t.sag();
        if nr != Some(a.nr) {
            return Err(UiFejl::IntetResultat);
        }
        Ok(a.aaben.as_ref().map(|x| x.hoved.navn.clone()))
    };
    if fil {
        let g = t.fil(Visning::Masker);
        let r = g.as_ref().ok_or(UiFejl::IngenFil)?.resultat.as_ref().ok_or(UiFejl::IntetResultat)?;
        let tal = r.kvit.as_ref().ok_or(UiFejl::IntetResultat)?;
        let navn = navn_for(r.sag_nr)?;
        Ok(kvit::tekst(tal, navn.as_deref(), Kilde::Fil, engelsk))
    } else {
        let mut g = t.kvit_tekst();
        let Some((nr, tal)) = g.as_ref() else {
            return Err(UiFejl::IntetResultat);
        };
        match navn_for(Some(*nr)) {
            Ok(navn) => Ok(kvit::tekst(tal, navn.as_deref(), Kilde::Tekst, engelsk)),
            Err(f) => {
                // Sagen er en anden: tallene hører til et resultat, der ikke findes længere.
                *g = None;
                Err(f)
            }
        }
    }
}

/// Forslaget til Gem-dialogen: mappen (den åbne fils) og filnavnet. Bliver i Rust.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Forslag {
    /// Mappen.
    pub mappe: Option<PathBuf>,
    /// Filnavnet.
    pub navn: String,
}

/// Må resultatet gemmes? Maskér: et resultat for den åbne sag, og rester kræver `alligevel`. Demaskér: et resultat og
/// brugerens bekræftelse (`bekraeftet`).
fn tjek_gem(t: &Tilstand, v: Visning, h: &HoldtFil, ok: bool) -> Result<(), UiFejl> {
    let r = h.resultat.as_ref().ok_or(UiFejl::IntetResultat)?;
    match v {
        Visning::Masker => {
            if r.sag_nr != Some(t.sag().nr) {
                return Err(UiFejl::Foraeldet);
            }
            if r.rester > 0 && !ok {
                return Err(UiFejl::Rester { antal: r.rester });
            }
        }
        Visning::Demasker => {
            if !ok {
                return Err(UiFejl::IkkeBekraeftet);
            }
        }
    }
    Ok(())
}

/// Tjekker, at resultatet må gemmes, og foreslår mappe og navn: `<navn>.maskeret.<endelse>` (Maskér) eller
/// `<navn>.demaskeret.<endelse>` (Demaskér). `ok`: "Gem alligevel" (Maskér) eller bekræftelsen (Demaskér).
pub fn fil_gem_forslag(t: &Tilstand, v: Visning, ok: bool) -> Result<Forslag, UiFejl> {
    t.aaben()?;
    let g = t.fil(v);
    let h = g.as_ref().ok_or(UiFejl::IngenFil)?;
    tjek_gem(t, v, h, ok)?;
    Ok(Forslag {
        mappe: h.fil.sti.parent().map(|p| p.to_path_buf()),
        navn: match v {
            Visning::Masker => fil::forslag(&h.fil.navn, "maskeret"),
            Visning::Demasker => fil::forslag_demaskeret(&h.fil.navn),
        },
    })
}

/// Skriver resultatet til `sti` med filens tegnsæt (og BOM) atomart, efter samme tjek som [`fil_gem_forslag`]. De åbne
/// filer overskrives aldrig. Svarer med filnavnet.
pub fn fil_gem_til(t: &Tilstand, v: Visning, sti: &std::path::Path, ok: bool) -> Result<String, UiFejl> {
    fil_gem_til_med(t, v, sti, ok, &mut || Ok(()))
}

/// Som [`fil_gem_til`] med et kald lige før omdøbningen (tests: en afbrudt skrivning, V-RET.1 R5).
#[doc(hidden)]
pub fn fil_gem_til_med(
    t: &Tilstand,
    v: Visning,
    sti: &std::path::Path,
    ok: bool,
    foer_omdoeb: &mut dyn FnMut() -> std::io::Result<()>,
) -> Result<String, UiFejl> {
    t.aaben()?;
    let aabne = t.aabne_stier();
    let g = t.fil(v);
    let h = g.as_ref().ok_or(UiFejl::IngenFil)?;
    tjek_gem(t, v, h, ok)?;
    let r = h.resultat.as_ref().ok_or(UiFejl::IntetResultat)?;
    let ikke_til: Vec<&std::path::Path> = aabne.iter().map(PathBuf::as_path).collect();
    fil::skriv_noteret(sti, &r.tekst, h.fil.tegnsaet, &ikke_til, t.igang.as_ref(), foer_omdoeb)?;
    Ok(sti.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default())
}

/// Svaret fra "Start forfra".
#[derive(Clone, Serialize)]
pub struct StartForfra {
    /// Den nye, tomme ordbog.
    pub ordbog: OrdbogUd,
    /// Det nye navn på den gamle fil (`None`: der var ingen fil).
    pub flyttet_til: Option<String>,
}

/// V-FIL.1 F5: en ordbog, der ikke kan åbnes, flyttes til side som `ordbog.<dato>.ulaeselig` (slettes ikke), og en tom
/// ordbog tager over. Kan ordbogen åbnes, gør kommandoen intet. `dato`: i dag, `ÅÅÅÅ-MM-DD` (webvisningens kalender).
pub fn ordbog_start_forfra(t: &Tilstand, dato: &str) -> Result<StartForfra, UiFejl> {
    t.aaben()?;
    tjek_dato(dato)?;
    let mut g = t.ordbog();
    // V-LAAS.3: som `aendr_ordbog`.
    t.aaben()?;
    let o = g.get_or_insert_with(OrdbogTilstand::default);
    if o.fejl.is_none() {
        return Ok(StartForfra {
            ordbog: ordbog_ud(o),
            flyttet_til: None,
        });
    }
    let flyttet_til = match &t.ordbogsfil {
        Some(fil) => fil.flyt_ulaeselig(dato).map_err(|fejl| UiFejl::OrdbogFil { fejl })?,
        None => None,
    };
    o.erstat(Vec::new());
    o.taeller = 0;
    o.fejl = None;
    Ok(StartForfra {
        ordbog: ordbog_ud(o),
        flyttet_til,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linjenumre() {
        let l = Linjer::ny("a\r\nb\nc");
        assert_eq!((l.af(0), l.af(3), l.af(5)), (1, 2, 3));
        // Et enligt CR er også et linjeskift (V-RET.1 R3): linjenumrene følger antal_linjer.
        let l = Linjer::ny("a\rb\r\nc");
        assert_eq!((l.af(0), l.af(2), l.af(5)), (1, 2, 3));
        assert_eq!(fil::antal_linjer("a\rb\r\nc"), 3);
    }

    #[test]
    fn graensen_er_5_mib() {
        assert_eq!(MAKS_BYTES, 5_242_880);
        assert_eq!(tjek_tekst(""), Err(UiFejl::TomTekst));
        let stor = "a".repeat(MAKS_BYTES + 1);
        assert_eq!(
            tjek_tekst(&stor),
            Err(UiFejl::ForStor {
                bytes: MAKS_BYTES + 1,
                maks: MAKS_BYTES
            })
        );
        assert!(tjek_tekst(&stor[..MAKS_BYTES]).is_ok());
    }
}
