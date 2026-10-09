import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { setCredentials, validateEndpoint } from "../lib/auth";

interface Props {
  onAuthenticated: () => void;
}

export default function LoginScreen({ onAuthenticated }: Props) {
  const [endpoint, setEndpoint] = React.useState("");
  const [token, setToken] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const tokenInputRef = React.useRef<TextInput>(null);

  const handleSubmit = React.useCallback(async () => {
    setError(null);
    const trimmedToken = token.trim();
    if (!endpoint.trim()) {
      setError("Endpoint URL is required");
      return;
    }
    if (!trimmedToken) {
      setError("Bearer token is required");
      return;
    }

    let cleanedUrl: string;
    try {
      cleanedUrl = validateEndpoint(endpoint);
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    setLoading(true);
    try {
      setCredentials({ baseUrl: cleanedUrl, token: trimmedToken });
      onAuthenticated();
    } catch {
      setError("Authentication setup failed");
    } finally {
      setLoading(false);
    }
  }, [endpoint, token, onAuthenticated]);

  const handleEndpointSubmit = React.useCallback(() => {
    // Enter on endpoint focuses token (returnKeyType="next")
    tokenInputRef.current?.focus();
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.card}>
        <Text style={styles.title} accessibilityRole="header">
          Iris Clients
        </Text>
        <Text style={styles.subtitle}>Connect to your Iris instance</Text>

        <Text style={styles.label}>Endpoint URL</Text>
        <TextInput
          style={styles.input}
          value={endpoint}
          onChangeText={setEndpoint}
          placeholder="https://iris.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          testID="endpoint-input"
          onSubmitEditing={handleEndpointSubmit}
          returnKeyType="next"
          accessibilityLabel="Endpoint URL"
          blurOnSubmit={false}
        />

        <Text style={styles.label}>Bearer Token</Text>
        <TextInput
          ref={tokenInputRef}
          style={styles.input}
          value={token}
          onChangeText={setToken}
          placeholder="tok_..."
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          testID="token-input"
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
          accessibilityLabel="Bearer token"
        />

        {error && (
          <Text
            style={styles.error}
            testID="login-error"
            accessibilityRole="alert"
          >
            {error}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          testID="login-button"
          accessibilityRole="button"
          accessibilityLabel="Connect"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connect</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.attribution}>
          Powered by Iris · @techgod/iris-client v0.4.0
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#f8fafc",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 8,
    color: "#f8fafc",
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    outlineColor: "#6366f1", // keyboard focus ring (web)
  } as object,
  error: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#6366f1",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  attribution: {
    fontSize: 11,
    color: "#475569",
    marginTop: 20,
    textAlign: "center",
  },
});
