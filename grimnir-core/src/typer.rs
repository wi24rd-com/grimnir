//! Offentlige typer: fund, erstatninger, rester, advarsler og fejl.

use std::fmt;

use crate::graense::Moenster;
use crate::original::Original;

/// Hvad et fund er.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Art {
    /// IPv4-adresse i et eget net (RFC 1918 eller ordbogens net).
    Ipv4Egen,
    /// Anden offentlig IPv4-adresse (maskeres kun med tilvalg, ADR D4).
    Ipv4Fremmed,
    /// IPv6-adresse i et eget net (ULA, link-local bygget på en MAC).
    Ipv6Egen,
    /// Anden IPv6-adresse (maskeres kun med tilvalg).
    Ipv6Fremmed,
    /// MAC-adresse.
    Mac,
    /// Værtsnavn (kort form eller første del af et FQDN).
    Vaert,
    /// DNS-domæne.
    Domaene,
    /// NetBIOS-domæne (`KONTOR` i `KONTOR\bruger`), en anden enhed end DNS-domænet (kontrol 8.4).
    NetbiosDomaene,
    /// Brugernavn.
    Bruger,
    /// Person i fri tekst (fra ordbogen).
    Person,
    /// Databasenavn efter nøgleord.
    Database,
    /// Ord fra ordbogen, OU- og DC-dele.
    Ord,
    /// Hemmelighed: adgangskode, nøgle, token, JWT, privat nøgle.
    Hemmelighed,
    /// Windows-SID for en konto eller et domæne.
    Sid,
    /// GUID efter nøgleord (tenant, subscription, client_id).
    Guid,
    /// Serienummer efter nøgleord.
    Serienummer,
    /// CPR-nummer med gyldig dato.
    Cpr,
    /// Lang streng med høj entropi ("tjek selv").
    Entropi,
    /// Tekst, der allerede har en kodes form ("ligner en kode", kontrol 8.1).
    LignerKode,
}

/// Hvor sikkert et fund er.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Sikkerhed {
    /// Genkendt efter en entydig form.
    Sikker,
    /// Genkendt via brugerens ordbog.
    Ordbog,
    /// Sandsynligt følsomt; foreslås maskeret.
    Sandsynlig,
    /// Brugeren skal selv afgøre det; foreslås ikke maskeret.
    TjekSelv,
    /// Versionsnummer, der ligner en adresse; maskeres ikke.
    Version,
}

/// Den sammensatte værdi, et fund er en del af.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Sammensat {
    /// `vaert.domaene`
    Fqdn,
    /// `bruger@domaene`
    Mail,
    /// `DOMÆNE\bruger`
    DomaeneBruger,
    /// URL
    Url,
    /// UNC-sti `\\vaert\del`
    Unc,
    /// AD-sti `CN=…,OU=…,DC=…`
    AdSti,
    /// Hjemmemappe i en sti
    Hjemmemappe,
}

/// Et fund i en tekst. Spændet er byte-positioner i teksten; fundet indeholder ikke selve værdien.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fund {
    /// Første byte.
    pub start: usize,
    /// Byte efter sidste byte.
    pub slut: usize,
    /// Hvad fundet er.
    pub art: Art,
    /// Hvor sikkert det er.
    pub sikkerhed: Sikkerhed,
    /// Den sammensatte værdi, fundet er en del af, hvis det er opdelt.
    pub del_af: Option<Sammensat>,
    /// Sand, hvis fundet er en afledt form (en del af en sammensat værdi fundet alene andetsteds).
    pub afledt: bool,
}

/// Den slags kode, en værdi får. Afgør kodens form, nummerserie og grænseregel.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Klasse {
    /// `h0001`
    Vaert,
    /// `d01.example`
    Domaene,
    /// `NB01`
    Netbios,
    /// `user0001`
    Bruger,
    /// `Person 0001`
    Person,
    /// `db0001`
    Database,
    /// `ord0001`
    Ord,
    /// `GRIMNIR_SECRET_0001`
    Hemmelighed,
    /// `sn0001`
    Serie,
    /// `000000-0001`
    Cpr,
    /// `00000000-0000-0000-0000-000000000001`
    Guid,
    /// `S-1-5-21-0-0-1-<RID>`
    Sid,
    /// Adresse i 198.18.0.0/15, dokumentationsnettene eller 240.0.0.0/4
    Ipv4,
    /// Adresse i 2001:db8::/32 eller 3fff::/20
    Ipv6,
    /// 00:00:5e:00:53:xx eller 02:00:00:xx:xx:xx
    Mac,
}

/// Antal klasser (størrelsen på tællertabellen).
pub const KLASSER: usize = 15;

impl Klasse {
    /// Alle klasser i fast rækkefølge.
    pub const ALLE: [Klasse; KLASSER] = [
        Klasse::Vaert,
        Klasse::Domaene,
        Klasse::Netbios,
        Klasse::Bruger,
        Klasse::Person,
        Klasse::Database,
        Klasse::Ord,
        Klasse::Hemmelighed,
        Klasse::Serie,
        Klasse::Cpr,
        Klasse::Guid,
        Klasse::Sid,
        Klasse::Ipv4,
        Klasse::Ipv6,
        Klasse::Mac,
    ];

    /// Klassens plads i tællertabellen.
    pub fn nr(self) -> usize {
        Klasse::ALLE.iter().position(|k| *k == self).unwrap_or(0)
    }

    /// Grænsereglen for klassens koder.
    pub fn moenster(self) -> Moenster {
        match self {
            Klasse::Ipv4 => Moenster::Ipv4,
            Klasse::Ipv6 | Klasse::Mac => Moenster::Hex,
            _ => Moenster::Navn,
        }
    }

    /// Sand, hvis store og små bogstaver er samme enhed (alt undtagen hemmeligheder).
    pub(crate) fn foldes(self) -> bool {
        self != Klasse::Hemmelighed
    }

    /// Sand, hvis koden spejler originalens store/små bogstaver og kan få et bogstav bagefter.
    pub(crate) fn spejler(self) -> bool {
        matches!(
            self,
            Klasse::Vaert
                | Klasse::Domaene
                | Klasse::Netbios
                | Klasse::Bruger
                | Klasse::Person
                | Klasse::Database
                | Klasse::Ord
                | Klasse::Serie
        )
    }

    /// Kodens grundform for nummer `n` (ADR-001 D6; mindst fire cifre, to for domæner).
    pub(crate) fn grundform(self, n: u64) -> String {
        match self {
            Klasse::Vaert => format!("h{n:04}"),
            Klasse::Domaene => format!("d{n:02}.example"),
            Klasse::Netbios => format!("NB{n:02}"),
            Klasse::Bruger => format!("user{n:04}"),
            Klasse::Person => format!("Person {n:04}"),
            Klasse::Database => format!("db{n:04}"),
            Klasse::Ord => format!("ord{n:04}"),
            Klasse::Hemmelighed => format!("GRIMNIR_SECRET_{n:04}"),
            Klasse::Serie => format!("sn{n:04}"),
            Klasse::Cpr => format!("000000-{n:04}"),
            Klasse::Guid => format!("00000000-0000-0000-0000-{n:012}"),
            Klasse::Sid | Klasse::Ipv4 | Klasse::Ipv6 | Klasse::Mac => String::new(),
        }
    }
}

impl Klasse {
    /// Fundets art for en værdi af denne klasse (bruges, når en kendt original findes igen).
    pub(crate) fn art(self) -> Art {
        match self {
            Klasse::Vaert => Art::Vaert,
            Klasse::Domaene => Art::Domaene,
            Klasse::Netbios => Art::NetbiosDomaene,
            Klasse::Bruger => Art::Bruger,
            Klasse::Person => Art::Person,
            Klasse::Database => Art::Database,
            Klasse::Ord => Art::Ord,
            Klasse::Hemmelighed => Art::Hemmelighed,
            Klasse::Serie => Art::Serienummer,
            Klasse::Cpr => Art::Cpr,
            Klasse::Guid => Art::Guid,
            Klasse::Sid => Art::Sid,
            Klasse::Ipv4 => Art::Ipv4Egen,
            Klasse::Ipv6 => Art::Ipv6Egen,
            Klasse::Mac => Art::Mac,
        }
    }
}

impl Art {
    /// Den kodeklasse, fundet får. `LignerKode` og `Entropi` afgøres af værdien.
    pub fn klasse(self) -> Klasse {
        match self {
            Art::Ipv4Egen | Art::Ipv4Fremmed => Klasse::Ipv4,
            Art::Ipv6Egen | Art::Ipv6Fremmed => Klasse::Ipv6,
            Art::Mac => Klasse::Mac,
            Art::Vaert => Klasse::Vaert,
            Art::Domaene => Klasse::Domaene,
            Art::NetbiosDomaene => Klasse::Netbios,
            Art::Bruger => Klasse::Bruger,
            Art::Person => Klasse::Person,
            Art::Database => Klasse::Database,
            Art::Ord | Art::LignerKode => Klasse::Ord,
            Art::Hemmelighed | Art::Entropi => Klasse::Hemmelighed,
            Art::Sid => Klasse::Sid,
            Art::Guid => Klasse::Guid,
            Art::Serienummer => Klasse::Serie,
            Art::Cpr => Klasse::Cpr,
        }
    }
}

/// En foreslået erstatning: spændet i teksten, koden og originalen.
#[derive(Clone)]
pub struct Erstatning {
    /// Første byte i teksten.
    pub start: usize,
    /// Byte efter sidste byte.
    pub slut: usize,
    /// Koden, der sættes ind.
    pub kode: String,
    /// Originalen (præcise bytes).
    pub original: Original,
    /// Fundets art.
    pub art: Art,
}

impl fmt::Debug for Erstatning {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Erstatning")
            .field("start", &self.start)
            .field("slut", &self.slut)
            .field("kode", &self.kode)
            .field("original", &"<skjult>")
            .field("art", &self.art)
            .finish()
    }
}

/// Hvad lækagetjekket fandt.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RestArt {
    /// En af sagens originaler står stadig i teksten.
    Original(Klasse),
    /// Genkenderne finder noget nyt, som ikke er en af sagens koder.
    NytFund(Art),
}

/// Et sted i det maskerede resultat, der ikke er en kode, men burde være det.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Rest {
    /// Første byte.
    pub start: usize,
    /// Byte efter sidste byte.
    pub slut: usize,
    /// Hvad der blev fundet.
    pub art: RestArt,
}

/// Hvilken pulje der løb over.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Pulje {
    /// Mere end 512 egne /24-net.
    EgneNet,
    /// Mere end 762 fremmede adresser (dokumentationsnettene er brugt op).
    Fremmede,
    /// Mere end 256 MAC-adresser.
    Mac,
    /// 2001:db8::/32 er brugt op.
    Ipv6,
}

/// Hvordan en kode er blevet ændret i teksten, der demaskeres.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AfledtArt {
    /// Anden stavemåde (store/små bogstaver).
    AndenStavemaade,
    /// Værten står alene, hvor originalen kun havde FQDN'et.
    FqdnForkortet,
    /// Domænet står alene, hvor originalen kun havde det som del af et navn.
    DomaeneAlene,
    /// Escaped i JSON (`NB01\\user0001`).
    Escaped,
    /// URL-kodet (`%40`, `%5C`).
    UrlKodet,
}

/// Hvad en advarsel handler om.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AdvarselArt {
    /// Ukendt adresse i et af sagens net; forslaget er den tilsvarende rigtige adresse.
    UkendtAdresseISagensNet,
    /// Ukendt kode af kendt form; står urørt.
    UkendtKode,
    /// En kode i en afledt form; er sat tilbage.
    AfledtForm(AfledtArt),
    /// En af sagens koder forekommer ikke i teksten (oplysning).
    IkkeBrugt,
    /// Mange ukendte koder: teksten ligner en anden sag.
    LignerAndenSag,
    /// En pulje løb over under tildeling af koder.
    Overloeb(Pulje),
}

/// En advarsel fra tildeling eller demaskering.
#[derive(Clone)]
pub struct Advarsel {
    /// Hvad advarslen handler om.
    pub art: AdvarselArt,
    /// Første byte i teksten (0 for advarsler uden sted).
    pub start: usize,
    /// Byte efter sidste byte.
    pub slut: usize,
    /// Koden, det handler om (tom, hvis ingen).
    pub kode: String,
    /// Forslag til en rigtig værdi (fx den tilsvarende rigtige adresse).
    pub forslag: Option<Original>,
}

impl fmt::Debug for Advarsel {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Advarsel")
            .field("art", &self.art)
            .field("start", &self.start)
            .field("slut", &self.slut)
            .field("kode", &self.kode)
            .field("forslag", &self.forslag.as_ref().map(|_| "<skjult>"))
            .finish()
    }
}

/// Fejl fra kernen. Ingen variant indeholder en original.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Fejl {
    /// Den nye kode findes allerede i sagen eller i teksten.
    KodeKolliderer {
        /// Den kode, brugeren ønskede.
        kode: String,
    },
    /// Koden findes ikke i sagen.
    UkendtKode {
        /// Den kode, der blev spurgt efter.
        kode: String,
    },
    /// Den nye kode er tom eller begynder eller slutter med et grænsetegn.
    UgyldigKode {
        /// Den kode, brugeren ønskede.
        kode: String,
    },
    /// Et net i ordbogen kan ikke læses.
    UgyldigtNet {
        /// Nettets plads i listen.
        indgang: usize,
    },
    /// Sagsdata hænger ikke sammen (B3 kan have læst en beskadiget fil).
    UgyldigeSagsdata {
        /// Hvilken del der fejler.
        hvad: &'static str,
    },
}

impl fmt::Display for Fejl {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Fejl::KodeKolliderer { kode } => write!(f, "koden {kode} findes allerede i sagen eller i teksten"),
            Fejl::UkendtKode { kode } => write!(f, "koden {kode} findes ikke i sagen"),
            Fejl::UgyldigKode { kode } => write!(f, "koden {kode:?} er tom eller begynder eller slutter med et grænsetegn"),
            Fejl::UgyldigtNet { indgang } => write!(f, "net nr. {indgang} i ordbogen kan ikke læses"),
            Fejl::UgyldigeSagsdata { hvad } => write!(f, "sagsdata hænger ikke sammen: {hvad}"),
        }
    }
}

impl std::error::Error for Fejl {}
