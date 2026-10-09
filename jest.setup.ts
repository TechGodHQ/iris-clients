// Polyfill URL/URLSearchParams for the React Native jest environment
// (jest-environment-node via @react-native/jest-preset does not expose browser globals)
import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'url';

const g = global as Record<string, unknown>;
if (!g['URL']) g['URL'] = NodeURL;
if (!g['URLSearchParams']) g['URLSearchParams'] = NodeURLSearchParams;
