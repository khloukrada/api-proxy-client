import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { SanctumSignInView } from 'src/auth/view/sanctum';

// ----------------------------------------------------------------------

export const metadata: Metadata = { title: `Sign in | ${CONFIG.appName}` };

export default function Page() {
  return <SanctumSignInView />;
}
