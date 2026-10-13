import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { clearCredentials } from "../lib/auth";
import { useThreads } from "../hooks/useThreads";
import type { IrisThread } from "../types/thread";

interface Props {
  onLogout: () => void;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year:
        d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return "";
  }
}

function providerLabel(thread: IrisThread): string {
  if (thread.provider_instance.length > 0) return thread.provider_instance;
  // Fallback when legacy optional field absent
  return thread.source;
}

function ThreadRow({ thread }: { thread: IrisThread }) {
  return (
    // Read-only row — no press handler, no clickable stub
    <View
      style={styles.row}
      testID={`thread-row-${thread.id}`}
      accessibilityRole="text"
    >
      <View style={styles.rowMain}>
        <View style={styles.rowHeader}>
          <Text
            style={styles.rowTitle}
            numberOfLines={1}
            accessibilityLabel={thread.title ?? thread.id}
          >
            {thread.title ?? thread.id}
          </Text>
          {thread.unread_count > 0 && (
            <View
              style={styles.badge}
              accessibilityLabel={`${thread.unread_count} unread`}
            >
              <Text style={styles.badgeText}>{thread.unread_count}</Text>
            </View>
          )}
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.metaProvider} numberOfLines={1}>
            {providerLabel(thread)}
          </Text>
          <Text style={styles.metaDate}>{formatDate(thread.last_message_at)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function ThreadsScreen({ onLogout }: Props) {
  const { state, load, loadMore, reset } = useThreads();

  React.useEffect(() => {
    load();
  }, [load]);

  const handleLogout = React.useCallback(() => {
    clearCredentials();
    reset();
    onLogout();
  }, [reset, onLogout]);

  const handleRetry = React.useCallback(() => {
    load();
  }, [load]);

  const handleLoadMore = React.useCallback(() => {
    if (state.status === "loaded" && state.nextCursor) {
      loadMore(state.nextCursor);
    }
  }, [state, loadMore]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          Threads
        </Text>
        <TouchableOpacity
          onPress={handleLogout}
          testID="logout-button"
          accessibilityRole="button"
          accessibilityLabel="Logout"
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Loading */}
      {state.status === "loading" && (
        <View style={styles.center} testID="loading-indicator">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading threads…</Text>
        </View>
      )}

      {/* Error (full-page: unauthorized or network) */}
      {state.status === "error" && (
        <View style={styles.center} testID="error-view">
          <Text
            style={styles.errorText}
            testID="error-message"
            accessibilityRole="alert"
          >
            {state.message}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={handleRetry}
            testID="retry-button"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
          {state.message.toLowerCase().includes("unauthorized") && (
            <TouchableOpacity
              style={styles.reconnectBtn}
              onPress={handleLogout}
              testID="reconnect-button"
              accessibilityRole="button"
            >
              <Text style={styles.reconnectText}>Reconnect with different credentials</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Empty */}
      {state.status === "loaded" && state.threads.length === 0 && (
        <View style={styles.center} testID="empty-view">
          <Text style={styles.emptyText}>No threads found</Text>
          <Text style={styles.emptySubtext}>
            Check your Iris instance for conversations.
          </Text>
        </View>
      )}

      {/* Thread list — FlatList without onEndReached for browser-first pilot.
          Explicit Load More button avoids infinite auto-fetch against fixtures. */}
      {state.status === "loaded" && state.threads.length > 0 && (
        <FlatList
          data={state.threads}
          keyExtractor={(item) => `${item.provider_instance}:${item.id}`}
          renderItem={({ item }) => <ThreadRow thread={item} />}
          testID="threads-list"
          ListFooterComponent={
            <>
              {state.loadMoreError && (
                <Text
                  style={styles.loadMoreError}
                  testID="load-more-error"
                  accessibilityRole="alert"
                >
                  {state.loadMoreError}
                </Text>
              )}
              {state.nextCursor ? (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={handleLoadMore}
                  testID="load-more-button"
                  accessibilityRole="button"
                >
                  <Text style={styles.loadMoreText}>Load more</Text>
                </TouchableOpacity>
              ) : null}
            </>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f8fafc",
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  logoutText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    color: "#64748b",
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: "#f87171",
    fontSize: 15,
    marginBottom: 16,
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#6366f1",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 10,
  },
  retryText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  reconnectBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#475569",
  },
  reconnectText: {
    color: "#94a3b8",
    fontSize: 13,
  },
  emptyText: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  rowMain: {
    flex: 1,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  rowTitle: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  badge: {
    backgroundColor: "#6366f1",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  rowMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaProvider: {
    color: "#64748b",
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  metaDate: {
    color: "#64748b",
    fontSize: 12,
  },
  loadMoreError: {
    color: "#f87171",
    fontSize: 13,
    textAlign: "center",
    margin: 12,
  },
  loadMoreBtn: {
    margin: 16,
    padding: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  loadMoreText: {
    color: "#6366f1",
    fontWeight: "600",
    fontSize: 14,
  },
});
