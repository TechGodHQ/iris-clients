import React from "react";
import LoginScreen from "../src/components/LoginScreen";
import ThreadsScreen from "../src/components/ThreadsScreen";
import { isAuthenticated } from "../src/lib/auth";

export default function Index() {
  const [authed, setAuthed] = React.useState(isAuthenticated);

  return authed ? (
    <ThreadsScreen onLogout={() => setAuthed(false)} />
  ) : (
    <LoginScreen onAuthenticated={() => setAuthed(true)} />
  );
}
