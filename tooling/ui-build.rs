// Shared Cargo build hook for the workspace's React frontends.
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::SystemTime,
};

fn authored(path: &Path, files: &mut Vec<PathBuf>) {
    if path.is_file() {
        files.push(path.to_owned());
        return;
    }
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .file_name()
                .is_some_and(|name| name == "node_modules" || name == "dist" || name == "work")
            {
                continue;
            }
            authored(&path, files);
        }
    }
}
fn modified(path: &Path) -> SystemTime {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .unwrap_or(SystemTime::UNIX_EPOCH)
}
fn npm(root: &Path, arguments: &[&str]) {
    let mut command = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/C", "npm"]);
        c
    } else {
        Command::new("npm")
    };
    let status = command
        .args(arguments)
        .current_dir(root)
        .status()
        .expect("could not start npm; install Node.js and run npm ci at ghostline77");
    assert!(
        status.success(),
        "frontend build failed; run npm ci and npm run build:uis at ghostline77"
    );
}
fn main() {
    let manifest =
        PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("Cargo manifest directory"));
    let workspace = manifest.parent().expect("workspace root");
    let ui = if manifest.join("ui").is_dir() {
        manifest.join("ui")
    } else {
        manifest.join("web")
    };
    let core = workspace.join("ui-core");
    let mut core_files = Vec::new();
    authored(&core.join("src"), &mut core_files);
    authored(&core.join("tooling"), &mut core_files);
    core_files.push(core.join("package.json"));
    let mut files = core_files.clone();
    authored(&ui.join("src"), &mut files);
    for entry in fs::read_dir(&ui)
        .expect("frontend source directory")
        .flatten()
    {
        if entry.path().is_file() {
            files.push(entry.path());
        }
    }
    files.push(workspace.join("package-lock.json"));
    for path in &files {
        println!("cargo:rerun-if-changed={}", path.display());
    }
    let core_newest = core_files
        .iter()
        .map(|p| modified(p))
        .max()
        .unwrap_or(SystemTime::UNIX_EPOCH);
    if modified(&core.join("dist/index.js")) < core_newest {
        npm(workspace, &["run", "build", "-w", "@ghostline/ui-core"]);
    }
    let newest = files
        .iter()
        .map(|p| modified(p))
        .max()
        .unwrap_or(SystemTime::UNIX_EPOCH);
    if modified(&ui.join("dist/index.html")) < newest {
        npm(&ui, &["run", "build"]);
    }
}
