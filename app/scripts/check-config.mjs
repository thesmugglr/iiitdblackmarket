import { loadEnv } from 'vite';
import { readClientConfig } from '../src/lib/config.ts';

const mode = process.argv[2] ?? 'production';
if (!['production','development'].includes(mode)) {
  console.error('Usage: npm run check:config -- [production|development]');
  process.exitCode = 1;
} else {
  const result = readClientConfig(loadEnv(mode, process.cwd(), 'VITE_'), mode === 'development');
  if (!result.configured) {
    console.error('Configuration is not ready (no credential values printed):');
    for (const issue of result.issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log(`Configuration shape passed for ${mode}. Live project reachability and OAuth are not tested by this command.`);
  }
}
