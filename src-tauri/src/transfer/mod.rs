use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

mod download;
mod entries;
mod errors;
mod ftp;
mod lifecycle;
mod metadata;
mod paths;
mod progress;
mod sftp;
mod state;
mod upload;

use paths::{join_remote_path, sanitize_transfer_name};
use progress::TransferProgressEvent;
use state::{transfer_retryable, TransferRetryOperation};
use tauri::AppHandle;

#[allow(unused_imports)]
pub use download::download_remote_file_to_path;
pub use download::{
    download_remote_entry, download_remote_entry_to_path, download_remote_file,
    prepare_remote_drag_file,
};
pub use entries::{
    create_remote_directory, delete_remote_entry, inspect_download_target, list_remote_directory,
    rename_remote_entry, update_remote_entry_permissions,
};
pub use upload::{upload_local_file, upload_remote_file};

const TRANSFER_CHUNK_SIZE: usize = 256 * 1024;
const TRANSFER_RETRY_MESSAGE: &str = "Retrying transfer";

pub fn cancel_transfer(transfer_id: &str) -> Result<(), String> {
    state::mark_transfer_cancelled(transfer_id)
}

pub fn retry_transfer(app: &AppHandle, transfer_id: &str) -> Result<(), String> {
    let operation = state::retry_operation(transfer_id)?;

    emit_retry_started(app, transfer_id, &operation);

    match operation {
        TransferRetryOperation::UploadRemoteFile {
            session,
            remote_dir,
            file_name,
            bytes,
            conflict_action,
        } => upload_remote_file(
            app,
            &session,
            &remote_dir,
            &file_name,
            bytes,
            Some(transfer_id.to_string()),
            Some(conflict_action),
        ),
        TransferRetryOperation::UploadLocalFile {
            session,
            remote_dir,
            local_path,
            remote_name,
            conflict_action,
        } => upload_local_file(
            app,
            &session,
            &remote_dir,
            &local_path,
            Some(transfer_id.to_string()),
            remote_name,
            Some(conflict_action),
        ),
        TransferRetryOperation::DownloadRemoteEntry {
            session,
            remote_path,
            kind,
            file_name,
            conflict_action,
        } => download_remote_entry(
            app,
            &session,
            &remote_path,
            &kind,
            Some(transfer_id.to_string()),
            Some(file_name),
            Some(conflict_action),
        )
        .map(|_| ()),
    }
}

fn generate_transfer_id(prefix: &str) -> String {
    format!(
        "{prefix}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    )
}

fn emit_retry_started(app: &AppHandle, transfer_id: &str, operation: &TransferRetryOperation) {
    match operation {
        TransferRetryOperation::UploadRemoteFile {
            file_name,
            remote_dir,
            ..
        } => emit_transfer(
            app,
            transfer_id,
            file_name,
            &join_remote_path(remote_dir, file_name),
            "upload",
            "upload",
            "queued",
            0,
            None,
            TRANSFER_RETRY_MESSAGE,
            None,
        ),
        TransferRetryOperation::UploadLocalFile {
            remote_dir,
            local_path,
            remote_name,
            ..
        } => {
            let local_path_buf = PathBuf::from(local_path);
            let file_name = remote_name
                .as_deref()
                .filter(|value| !value.trim().is_empty())
                .map(sanitize_transfer_name)
                .or_else(|| {
                    local_path_buf
                        .file_name()
                        .and_then(|value| value.to_str())
                        .map(ToOwned::to_owned)
                })
                .unwrap_or_else(|| "upload.bin".to_string());
            emit_transfer(
                app,
                transfer_id,
                &file_name,
                &join_remote_path(remote_dir, &file_name),
                "upload",
                "upload",
                "queued",
                0,
                None,
                TRANSFER_RETRY_MESSAGE,
                Some(local_path.as_str()),
            );
        }
        TransferRetryOperation::DownloadRemoteEntry {
            remote_path,
            file_name,
            ..
        } => emit_transfer(
            app,
            transfer_id,
            file_name,
            remote_path,
            "download",
            "download",
            "queued",
            0,
            None,
            TRANSFER_RETRY_MESSAGE,
            None,
        ),
    }
}

fn emit_transfer(
    app: &AppHandle,
    transfer_id: &str,
    file_name: &str,
    remote_path: &str,
    direction: &str,
    purpose: &str,
    state: &str,
    transferred_bytes: u64,
    total_bytes: Option<u64>,
    message: &str,
    local_path: Option<&str>,
) {
    progress::emit_transfer(
        app,
        TransferProgressEvent {
            transfer_id,
            file_name,
            remote_path,
            direction,
            purpose,
            state,
            transferred_bytes,
            total_bytes,
            message,
            local_path,
            retryable: (state == "error").then(|| transfer_retryable(transfer_id)),
        },
    );
}
