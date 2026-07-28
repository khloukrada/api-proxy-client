import { CONFIG } from 'src/global-config';

import { BlankView } from 'src/sections/blank/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <BlankView
      title="API Proxy Administration"
      description="Manage service credentials from the API Tokens section."
    />
  );
}
