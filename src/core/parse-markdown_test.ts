const text = `
# Demo document

<!--marktest body:
ABC
-->

<!--marktest stdout="output"-->
•••rust
// main.rs
mod other;

fn main() {
    println!("Hello {}", other::NAME);
}
•••

<!--marktest write="other.rs"-->
•••rust
// other.rs
pub const NAME: &str = "Robin";
•••

<!--marktest id="output"-->
•••text
Hello Robin
•••
`.replaceAll('•', '`');
