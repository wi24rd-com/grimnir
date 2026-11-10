//! Typen for originalværdier (K1).

/// En originalværdi fra brugerens tekst, med de præcise bytes.
///
/// Typen har bevidst hverken `Debug` eller `Display`, så en original ikke kan havne i en fejl,
/// en panikbesked eller en `Debug`-udskrift ved et uheld. Den læses kun med [`Original::som_tekst`].
#[derive(Clone, PartialEq, Eq, Hash)]
pub struct Original(String);

impl Original {
    /// Pakker en værdi ind.
    pub fn ny(tekst: impl Into<String>) -> Self {
        Original(tekst.into())
    }

    /// Værdien som tekst. Brug den kun til visning for brugeren eller til at gemme sagen krypteret.
    pub fn som_tekst(&self) -> &str {
        &self.0
    }

    /// Pakker værdien ud.
    pub fn til_tekst(self) -> String {
        self.0
    }

    /// Længden i bytes.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Sand, hvis værdien er tom.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}
