'use client';

import axios, { endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

export type SignInParams = {
  email: string;
  password: string;
};

export const signInWithPassword = async ({ email, password }: SignInParams): Promise<void> => {
  await axios.get(endpoints.auth.csrf);
  await axios.post(endpoints.auth.signIn, { email, password });
};

export const signOut = async (): Promise<void> => {
  await axios.post(endpoints.auth.signOut);
};
