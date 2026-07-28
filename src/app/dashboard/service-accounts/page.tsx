import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { ServiceAccountListView } from 'src/sections/service-account';

export const metadata: Metadata = { title: `Service accounts | ${CONFIG.appName}` };

export default function Page() {
  return <ServiceAccountListView />;
}
