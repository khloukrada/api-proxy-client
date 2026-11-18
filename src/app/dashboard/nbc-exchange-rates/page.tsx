import type { Metadata } from 'next';

import { CONFIG } from 'src/global-config';

import { NbcExchangeRateView } from 'src/sections/nbc-exchange-rate/nbc-exchange-rate-view';

export const metadata: Metadata = { title: `NBC Exchange Rates | ${CONFIG.appName}` };

export default function Page() {
  return <NbcExchangeRateView />;
}
