'use client';

import { SessionProvider } from 'next-auth/react';

export default function SessionProviderWrapper({ children, session }) {
    return (
        <SessionProvider session={session} refetchInterval={5}>
            {children}
        </SessionProvider>
    );
}