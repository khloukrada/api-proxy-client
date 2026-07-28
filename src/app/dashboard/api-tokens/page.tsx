import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { ApiTokenListView } from 'src/sections/api-token';

export const metadata: Metadata = { title: `API tokens | ${CONFIG.appName}` };

export default function Page() {
  return <ApiTokenListView />;
}
