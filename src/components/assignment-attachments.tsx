import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  downloadAssignmentAttachment,
  listAssignmentAttachments,
  uploadAssignmentAttachment,
  type AssignmentAttachment,
} from "../lib/adminApi";

const maxAttachmentSize = 10 * 1024 * 1024;

interface AssignmentAttachmentsProps {
  assignmentId: number;
  uploadedBy: "ADMIN" | "USER";
  userId?: number;
}

function formatSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssignmentAttachments({ assignmentId, uploadedBy, userId }: AssignmentAttachmentsProps) {
  const [attachments, setAttachments] = useState<AssignmentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const records = await listAssignmentAttachments(assignmentId, userId);
        if (active) {
          setAttachments(records);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Attachments could not be loaded.");
      } finally {
        refreshing = false;
        if (active) setLoading(false);
      }
    };

    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [assignmentId, userId]);

  async function pickAndUpload() {
    setError("");
    try {
      let filename: string;
      let mimeType: string;
      let fileSize: number | null | undefined;
      let readBase64: () => Promise<string>;

      if (Platform.OS === "web") {
        const result = await DocumentPicker.getDocumentAsync({ base64: true, multiple: false });
        if (result.canceled) return;
        const asset = result.assets[0];
        filename = asset.name;
        mimeType = asset.mimeType || "application/octet-stream";
        fileSize = asset.size;
        const webBase64 = asset.base64;
        if (!webBase64) throw new Error("The selected file could not be read by the browser.");
        readBase64 = async () => webBase64;
      } else {
        const result = await File.pickFileAsync({ mimeTypes: ["*/*"] });
        if (result.canceled) return;
        const file = result.result;
        filename = file.name;
        mimeType = file.type || "application/octet-stream";
        fileSize = file.size;
        readBase64 = () => file.base64();
      }

      if (fileSize !== undefined && fileSize !== null && fileSize > maxAttachmentSize) {
        setError("Files must be 10 MB or smaller.");
        return;
      }

      setUploading(true);
      const pickedBase64 = await readBase64();
      const base64 = pickedBase64.replace(/^data:[^,]*;base64,/i, "");
      if (!base64 || base64.length > Math.ceil(maxAttachmentSize / 3) * 4) {
        throw new Error("Files must be non-empty and 10 MB or smaller.");
      }
      const attachment = await uploadAssignmentAttachment(assignmentId, {
        base64,
        filename,
        mime_type: mimeType,
        uploaded_by: uploadedBy,
      }, userId);
      setAttachments((current) => [...current, attachment]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The file could not be attached.");
    } finally {
      setUploading(false);
    }
  }

  async function download(attachment: AssignmentAttachment) {
    setDownloadingId(attachment.id);
    setError("");
    try {
      const file = await downloadAssignmentAttachment(assignmentId, attachment.id, userId);
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = `data:${file.mime_type};base64,${file.base64}`;
        link.download = file.filename;
        link.click();
        return;
      }

      if (!FileSystem.cacheDirectory) throw new Error("The device cache is unavailable.");
      const safeName = file.filename.replace(/[\\/:*?"<>|]/g, "_");
      const localUri = `${FileSystem.cacheDirectory}${file.id}-${safeName}`;
      await FileSystem.writeAsStringAsync(localUri, file.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(localUri, {
        dialogTitle: file.filename,
        mimeType: file.mime_type,
      });
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "The attachment could not be opened.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>ATTACHMENTS</Text>
        <Pressable accessibilityRole="button" disabled={uploading} onPress={() => void pickAndUpload()} style={styles.attachButton}>
          <Ionicons name="attach" size={17} color="#D6453D" />
          <Text style={styles.attachText}>{uploading ? "UPLOADING..." : "ADD FILE"}</Text>
        </Pressable>
      </View>
      {loading && attachments.length === 0 ? <Text style={styles.empty}>Loading attachments...</Text> : null}
      {!loading && attachments.length === 0 ? <Text style={styles.empty}>No files attached yet.</Text> : null}
      {attachments.map((attachment) => (
        <Pressable
          accessibilityLabel={`Download ${attachment.filename}, attached by ${attachment.uploaded_by.toLowerCase()}`}
          accessibilityRole="button"
          disabled={downloadingId === attachment.id}
          key={attachment.id}
          onPress={() => void download(attachment)}
          style={styles.fileRow}
        >
          <Ionicons name="document-attach-outline" size={18} color="#D6453D" />
          <View style={styles.fileDetails}>
            <Text numberOfLines={1} style={styles.filename}>{attachment.filename}</Text>
            <Text style={styles.meta}>{attachment.uploaded_by} · {formatSize(attachment.file_size)} · {attachment.date_created}</Text>
          </View>
          <Ionicons name={downloadingId === attachment.id ? "hourglass-outline" : "download-outline"} size={18} color="#777777" />
        </Pressable>
      ))}
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderBottomColor: "#E6E6E6", borderBottomWidth: 1, borderTopColor: "#E6E6E6", borderTopWidth: 1, marginVertical: 17, paddingVertical: 12 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  title: { color: "#111111", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  attachButton: { alignItems: "center", flexDirection: "row", gap: 4, padding: 6 },
  attachText: { color: "#D6453D", fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  empty: { color: "#888888", fontSize: 12, paddingVertical: 5 },
  fileRow: { alignItems: "center", borderColor: "#EEEEEE", borderRadius: 5, borderWidth: 1, flexDirection: "row", gap: 9, marginTop: 6, padding: 9 },
  fileDetails: { flex: 1 },
  filename: { color: "#333333", fontSize: 12, fontWeight: "700" },
  meta: { color: "#888888", fontSize: 10, marginTop: 3 },
  error: { color: "#B53A33", fontSize: 11, marginTop: 7 },
});
