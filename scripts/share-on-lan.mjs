#!/usr/bin/env node
/**
 * Prints the address to open this dashboard from a phone or another computer
 * on the same network, with a QR code for the phone.
 *
 *   npm run share
 *
 * Pass a port if the server is not on the default 3000:  npm run share -- 3001
 *
 * This only covers devices on the same Wi-Fi. For access from anywhere, deploy
 * it — see "Deploy it somewhere shareable" in the README.
 */
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

const port = process.argv[2] ?? process.env.PORT ?? '3000';

/** Every non-internal IPv4 address, so the user can pick the right network. */
function localAddresses() {
  const found = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        found.push({ name, address: address.address });
      }
    }
  }
  return found;
}

const addresses = localAddresses();

if (addresses.length === 0) {
  console.error('No network connection found — connect to Wi-Fi and try again.');
  process.exit(1);
}

// Prefer a private-range address; those are the ones a phone can actually reach.
const preferred =
  addresses.find((a) => /^192\.168\./.test(a.address)) ??
  addresses.find((a) => /^10\./.test(a.address)) ??
  addresses[0];

const url = `http://${preferred.address}:${port}`;

console.log('');
console.log('  Ola News — open from another device on the same Wi-Fi');
console.log('  ' + '─'.repeat(52));
console.log(`  ${url}`);
if (addresses.length > 1) {
  console.log('');
  console.log('  Other interfaces on this machine:');
  for (const a of addresses.filter((a) => a !== preferred)) {
    console.log(`    ${a.name.padEnd(8)} http://${a.address}:${port}`);
  }
}
console.log('');

QRCode.toString(url, { type: 'terminal', small: true }, (error, qr) => {
  if (!error) {
    console.log('  Scan with your phone camera:');
    console.log(qr);
  }

  console.log('  Notes');
  console.log('  · Start the server with `npm run build && npm run start:lan`.');
  console.log('    Plain `npm run dev` listens on localhost only, and `npm run dev:lan`');
  console.log('    works but its hot-reload socket cannot reach another device, which');
  console.log('    leaves pages stuck on loading placeholders. Production mode has no');
  console.log('    such socket and is what you want for sharing anyway.');
  console.log('  · Both devices must be on the same Wi-Fi, and this Mac must stay awake.');
  console.log('  · The dashboard has no login. On a shared or public network, start it with');
  console.log('    OLA_NEWS_PUBLIC_READ_ONLY=true so visitors cannot change your data.');
  console.log('');
});
