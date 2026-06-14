// Active theme hook — follows the OS color scheme. Tokens come from
// tokens.ts (the faithful rx.bd port).

import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type Theme } from './tokens';

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTheme : lightTheme;
}

export { type Theme } from './tokens';
