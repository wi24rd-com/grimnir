// Intet konsolvindue på Windows i den færdige app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    grimnir_lib::run()
}
