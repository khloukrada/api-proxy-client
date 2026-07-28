import { AuthSplitLayout } from 'src/layouts/auth-split';

import { GuestGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <GuestGuard>
      <AuthSplitLayout
        slotProps={{
          section: {
            title: 'API Proxy Administration',
            subtitle: 'Manage scoped API access securely.',
          },
        }}
      >
        {children}
      </AuthSplitLayout>
    </GuestGuard>
  );
}
