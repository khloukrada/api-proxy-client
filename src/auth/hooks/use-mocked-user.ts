import { useAuthContext } from './use-auth-context';

// To get the user from the <AuthContext/>, you can use

// Change:
// import { useMockedUser } from 'src/auth/hooks';
// const { user } = useMockedUser();

// To:
// import { useAuthContext } from 'src/auth/hooks';
// const { user } = useAuthContext();

// ----------------------------------------------------------------------

export function useMockedUser() {
  const { user: authenticatedUser } = useAuthContext();

  const user = {
    id: authenticatedUser?.id ?? '',
    displayName: authenticatedUser?.displayName ?? authenticatedUser?.name ?? 'Administrator',
    email: authenticatedUser?.email ?? '',
    photoURL: '',
    phoneNumber: '',
    country: '',
    address: '',
    state: '',
    city: '',
    zipCode: '',
    about: '',
    role: authenticatedUser?.role ?? '',
    isPublic: true,
  };

  return { user };
}
